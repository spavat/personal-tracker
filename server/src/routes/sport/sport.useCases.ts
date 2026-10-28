import type { Segment, SaveBodyRequest } from "@personal-tracker/shared/sport";

import { FastifyBaseLogger } from "fastify";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { GpxStorageRepository } from "./gpx-storage.repository";
import type { SportRepository } from "./sport.repository";
import type { ThumbnailStorageRepository } from "./thumbnail-storage.repository";

import { buildGpxKey, buildThumbnailKey, cropActivity, extractGPXData } from "./sport.entity";
import { mapActivityType, parseStravaActivities } from "./strava-import";
import { generateThumbnail } from "./thumbnail";

export class ListActivitiesUseCase {
	constructor(private repo: SportRepository) {}

	execute({ from, to }: { from?: string; to?: string }, log: FastifyBaseLogger) {
		log.info("ListActivitiesUseCase.execute");
		return this.repo.findAll({ from, to });
	}
}

export class GetActivityUseCase {
	constructor(private repo: SportRepository) {}

	execute(id: string, log: FastifyBaseLogger) {
		log.info("GetActivityUseCase.execute");
		return this.repo.findById(id);
	}
}

export class DownloadActivityUseCase {
	constructor(
		private repo: SportRepository,
		private gpxStorage: GpxStorageRepository,
	) {}

	async execute(id: string, log: FastifyBaseLogger) {
		log.info("DownloadActivityUseCase.execute");
		const activity = await this.repo.findForDownload(id);
		if (!activity?.gpxKey) return null;

		return this.gpxStorage.getDownloadUrl(activity.gpxKey, activity.name);
	}
}

export class SaveActivityUseCase {
	constructor(
		private repo: SportRepository,
		private gpxStorage: GpxStorageRepository,
		private thumbnailStorage: ThumbnailStorageRepository,
	) {}

	async execute({ id, rawData, ...rest }: SaveBodyRequest, log: FastifyBaseLogger) {
		log.info("SaveActivityUseCase.execute");
		const activityId = id ?? randomUUID();
		log = log.child({ activityId, isNew: !id });

		const gpxData = rawData ? extractGPXData(rawData, rest.type) : null;

		let gpxKey: string | undefined;
		let thumbnailKey: string | undefined;
		if (rawData) {
			if (!gpxData?.date) {
				throw new Error("No date");
			}
			gpxKey = buildGpxKey(activityId, gpxData.date);
			await this.gpxStorage.upload(gpxKey, rawData);

			const thumbnail = await generateThumbnail(gpxData.points);
			if (thumbnail) {
				thumbnailKey = buildThumbnailKey(activityId, gpxData.date);
				await this.thumbnailStorage.upload(thumbnailKey, thumbnail);
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
		const { segments, points, ...activityLog } = dataToSave;
		log.info({ activity: activityLog }, "Saving activity");

		if (id) {
			return this.repo.update(id, dataToSave, dataToSave.comment === undefined ? ["comment"] : []);
		}
		if (!dataToSave.date) {
			throw new Error("No date");
		}
		return this.repo.insert({
			id: activityId,
			created: Temporal.Now.plainDateTimeISO().toString(),
			...dataToSave,
		});
	}
}

export class UpdateSegmentsUseCase {
	constructor(private repo: SportRepository) {}

	execute({ id, segments }: { id: string; segments: Segment[] }, log: FastifyBaseLogger) {
		log.info("UpdateSegmentsUseCase.execute");
		const sorted = [...segments].sort((a, b) => a.time - b.time);
		return this.repo.update(id, { segments: sorted });
	}
}

export class CropActivityUseCase {
	constructor(
		private repo: SportRepository,
		private thumbnailStorage: ThumbnailStorageRepository,
	) {}

	async execute(id: string, startIndex: number, endIndex: number, log: FastifyBaseLogger) {
		log.info("CropActivityUseCase.execute");
		const activity = await this.repo.findById(id);
		const points = activity?.points ?? [];
		if (endIndex >= points.length) {
			throw new Error("endIndex is out of bounds");
		}

		const cropped = cropActivity(points, activity?.segments, startIndex, endIndex, activity?.type);

		if (activity?.thumbnailKey) {
			const thumbnail = await generateThumbnail(cropped.points);
			if (thumbnail) await this.thumbnailStorage.upload(activity.thumbnailKey, thumbnail);
		}

		return this.repo.update(id, {
			points: cropped.points,
			details: cropped.details,
			segments: cropped.segments ?? [],
		});
	}
}

export class DeleteActivityUseCase {
	constructor(
		private repo: SportRepository,
		private gpxStorage: GpxStorageRepository,
		private thumbnailStorage: ThumbnailStorageRepository,
	) {}

	async execute(id: string, log: FastifyBaseLogger) {
		log.info("DeleteActivityUseCase.execute");
		log = log.child({ id });
		const activity = await this.repo.delete(id);
		log.info("Deleted activity");

		if (activity?.gpxKey) {
			await this.gpxStorage.delete(activity.gpxKey);
			log.info({ key: activity.gpxKey }, "Deleted GPX file");
		}
		if (activity?.thumbnailKey) {
			await this.thumbnailStorage.delete(activity.thumbnailKey);
			log.info({ key: activity.thumbnailKey }, "Deleted thumbnail");
		}

		return activity;
	}
}

const STRAVA_EXPORT_DIR = join(process.cwd(), "src", "data", "strava_export");

export class ImportActivitiesUseCase {
	constructor(
		private repo: SportRepository,
		private saveActivity: SaveActivityUseCase,
		private deleteActivity: DeleteActivityUseCase,
	) {}

	async execute(test: boolean, log: FastifyBaseLogger) {
		log.info("ImportActivitiesUseCase.execute");
		const csvContent = readFileSync(join(STRAVA_EXPORT_DIR, "activities.csv"), "utf-8");
		let rows = parseStravaActivities(csvContent).filter((row) => row.gpxFilename.endsWith(".gpx"));

		if (test) {
			const existing = (await this.repo.findAll()) ?? [];
			for (const activity of existing) {
				await this.deleteActivity.execute(activity.id, log);
			}
			// rows = rows.slice(0, 20);
			// rows = rows.filter((row) => ["13641439898", "10767283538", "20007409109", "19938941781"].includes(row.id));
		}

		let imported = 0;
		const errors: string[] = [];

		for (const row of rows) {
			console.log("====> STARTING IMPORT", row.id);
			try {
				const rawData = readFileSync(join(STRAVA_EXPORT_DIR, row.gpxFilename), "utf-8");
				await this.saveActivity.execute(
					{
						name: row.name,
						type: mapActivityType(row.type),
						...(row.description ? { comment: row.description } : {}),
						// overwritten from the GPX data by SaveActivityUseCase
						details: { totalDuration: 0, movingDuration: 0, distance: 0, pace: 0 },
						rawData,
					},
					log,
				);
				imported++;
			} catch (err) {
				errors.push(`${row.gpxFilename}: ${err instanceof Error ? err.message : String(err)}`);
			}
		}

		return { total: rows.length, imported, errors };
	}
}
