import type { SaveBodyRequest, Segment } from "@personal-tracker/shared/sport";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { BadRequestError, NotFoundError } from "../common/errors.js";
import { SportFilesStorage } from "./sport-files.storage.js";
import { buildGpxKey, buildThumbnailKey, cropActivity, extractGPXData } from "./sport.entity.js";
import { SportRepository } from "./sport.repository.js";
import { mapActivityType, parseStravaActivities } from "./strava-import.utils.js";
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

	// `stravaId`: the Strava activity it is imported from
	async create(body: SaveBodyRequest, stravaId?: string) {
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
			...(stravaId ? { stravaId } : {}),
		});
	}

	/**
	 * Imports the GPX activities of a Strava export folder (activities.csv + activities/*.gpx), skipping the ones
	 * already imported: it can be run again on a newer export. A failed activity is reported, the others go on.
	 */
	async importStrava(exportDir: string) {
		const rows = parseStravaActivities(await readFile(join(exportDir, "activities.csv"), "utf8")).filter((row) =>
			row.gpxFilename.endsWith(".gpx"),
		);
		const imported = await this.repo.findStravaIds();
		const toImport = rows.filter((row) => !imported.has(row.id));
		this.logger.log(`importStrava: ${rows.length} GPX activities, ${toImport.length} to import`);

		let created = 0;
		const errors: string[] = [];
		for (const row of toImport) {
			try {
				const rawData = await readFile(join(exportDir, row.gpxFilename), "utf8");
				await this.create(
					{
						name: row.name,
						type: mapActivityType(row.type),
						...(row.description ? { comment: row.description } : {}),
						// overwritten from the GPX data
						details: { totalDuration: 0, movingDuration: 0, distance: 0, pace: 0 },
						rawData,
					},
					row.id,
				);
				created++;
			} catch (error) {
				errors.push(`${row.gpxFilename}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		return { total: rows.length, skipped: rows.length - toImport.length, imported: created, errors };
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
