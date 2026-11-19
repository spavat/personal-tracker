import type { SaveBodyRequest, Segment } from "@personal-tracker/shared/sport";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { BadRequestError, NotFoundError } from "../common/errors.js";
import { SportFilesStorage } from "./sport-files.storage.js";
import { buildGpxKey, buildThumbnailKey, cropActivity, extractGPXData } from "./sport.entity.js";
import { SportRepository } from "./sport.repository.js";
import { generateThumbnail } from "./thumbnail.utils.js";

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
			throw new NotFoundError("activity", "sport.no_gpx", "the activity has no GPX file");
		}
		return this.files.gpxDownloadUrl(activity.gpxKey, activity.name);
	}

	async create(body: SaveBodyRequest) {
		const id = randomUUID();
		this.logger.log(`create ${id}`);
		const dataToSave = await this.prepare(id, body);
		if (!dataToSave.date) {
			throw new BadRequestError("sport.date_required", "a new activity needs a date or a GPX file");
		}
		return this.repo.insert({
			id,
			created: Temporal.Now.plainDateTimeISO().toString(),
			...dataToSave,
			date: dataToSave.date,
		});
	}

	async update(id: string, body: SaveBodyRequest) {
		this.logger.log(`update ${id}`);
		const dataToSave = await this.prepare(id, body);
		const unset = dataToSave.comment === undefined ? ["comment"] : [];
		return (await this.repo.update(id, dataToSave, unset)) ?? notFound();
	}

	// A GPX file (rawData) is stored in S3 and overrides the date, details, points and segments
	private async prepare(activityId: string, { rawData, ...rest }: SaveBodyRequest) {
		const gpxData = rawData ? extractGPXData(rawData, rest.type) : null;

		let gpxKey: string | undefined;
		let thumbnailKey: string | undefined;
		if (rawData) {
			if (!gpxData?.date) {
				throw new BadRequestError("sport.gpx_no_date", "the GPX file has no date");
			}
			gpxKey = buildGpxKey(activityId, gpxData.date);
			await this.files.uploadGpx(gpxKey, rawData);

			const thumbnail = await generateThumbnail(gpxData.points);
			if (thumbnail) {
				thumbnailKey = buildThumbnailKey(activityId, gpxData.date);
				await this.files.uploadThumbnail(thumbnailKey, thumbnail);
			}
		}

		return {
			...rest,
			...(gpxData?.date ? { date: gpxData.date.toString() } : {}),
			...(gpxData ? { details: gpxData.details, points: gpxData.points } : {}),
			...(gpxData?.segments ? { segments: gpxData.segments } : {}),
			...(gpxKey ? { gpxKey } : {}),
			...(thumbnailKey ? { thumbnailKey } : {}),
		};
	}

	async updateSegments(id: string, segments: Segment[]) {
		this.logger.log("updateSegments");
		return (await this.repo.update(id, { segments: segments.toSorted((a, b) => a.time - b.time) })) ?? notFound();
	}

	async crop(id: string, startIndex: number, endIndex: number) {
		this.logger.log("crop");
		const activity = (await this.repo.findById(id)) ?? notFound();
		const points = activity.points ?? [];
		if (endIndex >= points.length) {
			throw new BadRequestError("sport.crop_out_of_range", "endIndex out of the track");
		}

		const cropped = cropActivity(points, activity.segments, startIndex, endIndex, activity.type);

		if (activity.thumbnailKey) {
			const thumbnail = await generateThumbnail(cropped.points);
			if (thumbnail) await this.files.uploadThumbnail(activity.thumbnailKey, thumbnail);
		}

		return (
			(await this.repo.update(id, {
				points: cropped.points,
				details: cropped.details,
				segments: cropped.segments ?? [],
			})) ?? notFound()
		);
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
	}
}

function notFound(): never {
	throw new NotFoundError("activity");
}
