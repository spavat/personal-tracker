import type { SaveBodyRequest, Segment } from "@personal-tracker/shared/sport";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { BadRequestError, NotFoundError } from "../common/errors.js";
import { SportFilesStorage } from "./sport-files.storage.js";
import { buildGpxKey, buildThumbnailKey, cropActivity, extractGPXData } from "./sport.entity.js";
import { SportRepository } from "./sport.repository.js";
import { generateThumbnail } from "./thumbnail.js";

@Injectable()
export class SportService {
	private readonly logger = new Logger(SportService.name);
	constructor(
		private readonly repo: SportRepository,
		private readonly files: SportFilesStorage,
	) {}

	list({ from, to }: { from?: string; to?: string }) {
		this.logger.log("list");
		return this.repo.findAll({ from, to });
	}

	async get(id: string) {
		this.logger.log("get");
		return (await this.repo.findById(id)) ?? notFound();
	}

	async downloadUrl(id: string) {
		this.logger.log("downloadUrl");
		const activity = await this.repo.findForDownload(id);
		if (!activity?.gpxKey) {
			throw new NotFoundError("Pas de fichier GPX pour cette activité");
		}
		return this.files.gpxDownloadUrl(activity.gpxKey, activity.name);
	}

	// A GPX file (rawData) is stored in S3 and overrides the date, details, points and segments
	async save({ id, rawData, ...rest }: SaveBodyRequest) {
		const activityId = id ?? randomUUID();
		this.logger.log(`save ${activityId}${id ? "" : " (new)"}`);

		const gpxData = rawData ? extractGPXData(rawData, rest.type) : null;

		let gpxKey: string | undefined;
		let thumbnailKey: string | undefined;
		if (rawData) {
			if (!gpxData?.date) {
				throw new BadRequestError("Le fichier GPX n'a pas de date");
			}
			gpxKey = buildGpxKey(activityId, gpxData.date);
			await this.files.uploadGpx(gpxKey, rawData);

			const thumbnail = await generateThumbnail(gpxData.points);
			if (thumbnail) {
				thumbnailKey = buildThumbnailKey(activityId, gpxData.date);
				await this.files.uploadThumbnail(thumbnailKey, thumbnail);
			}
		}

		const dataToSave = {
			...rest,
			...(gpxData?.date ? { date: gpxData.date.toString() } : {}),
			...(gpxData ? { details: gpxData.details, points: gpxData.points } : {}),
			...(gpxData?.segments ? { segments: gpxData.segments } : {}),
			...(gpxKey ? { gpxKey } : {}),
			...(thumbnailKey ? { thumbnailKey } : {}),
		};

		if (id) {
			return this.repo.update(id, dataToSave, dataToSave.comment === undefined ? ["comment"] : []);
		}
		if (!dataToSave.date) {
			throw new BadRequestError("Une nouvelle activité a besoin d'une date ou d'un fichier GPX");
		}
		return this.repo.insert({
			id: activityId,
			created: Temporal.Now.plainDateTimeISO().toString(),
			...dataToSave,
			date: dataToSave.date,
		});
	}

	updateSegments(id: string, segments: Segment[]) {
		this.logger.log("updateSegments");
		return this.repo.update(id, { segments: segments.toSorted((a, b) => a.time - b.time) });
	}

	async crop(id: string, startIndex: number, endIndex: number) {
		this.logger.log("crop");
		const activity = (await this.repo.findById(id)) ?? notFound();
		const points = activity.points ?? [];
		if (endIndex >= points.length) {
			throw new BadRequestError("endIndex hors limites");
		}

		const cropped = cropActivity(points, activity.segments, startIndex, endIndex, activity.type);

		if (activity.thumbnailKey) {
			const thumbnail = await generateThumbnail(cropped.points);
			if (thumbnail) await this.files.uploadThumbnail(activity.thumbnailKey, thumbnail);
		}

		return this.repo.update(id, {
			points: cropped.points,
			details: cropped.details,
			segments: cropped.segments ?? [],
		});
	}

	// Deletes the activity, then its GPX file and thumbnail
	async delete(id: string) {
		this.logger.log(`delete ${id}`);
		const activity = (await this.repo.delete(id)) ?? notFound();

		for (const key of [activity.gpxKey, activity.thumbnailKey]) {
			if (key) {
				await this.files.delete(key);
				this.logger.log(`deleted ${key}`);
			}
		}
		return activity;
	}
}

function notFound(): never {
	throw new NotFoundError("Activité introuvable");
}
