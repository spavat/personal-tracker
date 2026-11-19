import type { PerformanceView } from "@personal-tracker/shared/show";

import { Injectable, Logger } from "@nestjs/common";

import type { SaveCastingBody, SavePerformanceBody } from "./performance.entity.js";

import { BadRequestError, NotFoundError } from "../../common/errors.js";
import { MediaStorageRepository } from "../media/media-storage.repository.js";
import { MediaRepository } from "../media/media.repository.js";
import { toModelView } from "../models/model.entity.js";
import { toPerformanceView } from "./performance.entity.js";
import { PerformancesRepository } from "./performances.repository.js";

@Injectable()
export class PerformancesService {
	private readonly logger = new Logger(PerformancesService.name);

	constructor(
		private readonly repo: PerformancesRepository,
		private readonly mediaRepo: MediaRepository,
		private readonly storage: MediaStorageRepository,
	) {}

	async list({ from, to, sort }: { from?: string; to?: string; sort?: string[] }): Promise<Array<PerformanceView>> {
		this.logger.log("list");
		// only the date is sortable
		const [, sortDirection] = sort ?? ["date", "asc"];
		const performances = await this.repo.findAllWithDetails({
			from,
			to,
			sortDirection: sortDirection === "desc" ? "desc" : "asc",
		});
		return performances.map(toPerformanceView);
	}

	async get(performanceId: number) {
		this.logger.log("get");
		const performance = await this.repo.findByIdWithDetails(performanceId);
		if (!performance) return null;
		// the details also need the spectacle models, for the casting form
		const { models, ...spectacle } = performance.spectacle!;
		return { ...toPerformanceView(performance), spectacle: { ...spectacle, models: models.map(toModelView) } };
	}

	async save(body: SavePerformanceBody) {
		this.logger.log("save");
		const { work, spectacle, place, performance } = body;

		return this.repo.runInTransaction(async (tx) => {
			let placeId = performance.placeId;
			if (!placeId && place) {
				const [placeResult] = await this.repo.insertPlace(tx, place);
				placeId = placeResult.id;
			}

			let spectacleId = performance.spectacleId;
			if (!spectacleId && spectacle) {
				let workId = spectacle.workId;
				if (!workId && work) {
					const [workResult] = await this.repo.insertWork(tx, work);
					workId = workResult.id;
				}
				const [spectacleResult] = await this.repo.insertSpectacle(tx, {
					name: spectacle.name,
					workId: workId ?? 0,
				});
				spectacleId = spectacleResult.id;
			}
			// the FK guarantees the poster belongs to the spectacle, not that it is a poster
			if (performance.posterId) {
				const kind = await this.repo.findSpectacleMediaKind(tx, spectacleId!, performance.posterId);
				if (kind !== "poster") {
					throw new BadRequestError("invalid_reference", "not a poster of the spectacle", {
						resource: "poster",
					});
				}
			}
			const dataToSave = {
				date: performance.date,
				canceled: performance.canceled,
				seat: performance.seat,
				casting_status: performance.casting_status,
				casting_origin: performance.casting_origin,
				posterId: performance.posterId,
				placeId,
				spectacleId: spectacleId!,
			};
			const [saved] = await this.repo.savePerformance(tx, performance.id, dataToSave);
			if (!saved) {
				// rolls back the place, work and spectacle created above
				throw new NotFoundError("performance");
			}
			return saved;
		});
	}

	async delete(id: number) {
		this.logger.log("delete");
		const keys = await this.repo.runInTransaction(async (tx) => {
			const pictures = await this.repo.findRolePictures(tx, id);
			const [deleted] = await this.repo.delete(tx, id);
			if (!deleted) {
				throw new NotFoundError("performance");
			}
			// a role portrait lives in the artist's gallery: it goes too once nothing uses it anymore
			const keys: string[] = [];
			for (const { artistId, pictureId } of pictures) {
				if ((await this.mediaRepo.countPictureUses(tx, artistId, pictureId)) > 0) {
					continue;
				}
				await this.mediaRepo.deleteLink(tx, { artistId }, pictureId);
				if ((await this.mediaRepo.countLinks(tx, pictureId)) === 0) {
					const [media] = await this.mediaRepo.deleteMedia(tx, pictureId);
					if (media) keys.push(media.key);
				}
			}
			return keys;
		});
		// after the commit: a failed S3 delete only leaves an unreferenced file
		for (const key of keys) {
			await this.storage
				.deleteObject(key)
				.catch((error) => this.logger.warn(`S3 media delete failed (${key}): ${String(error)}`));
		}
	}

	async saveCasting(data: SaveCastingBody) {
		this.logger.log("saveCasting");
		if (data) {
			const roles = data.roles.map((r) => ({ ...r, performanceId: data.performanceId }));
			const itemsToInsert = roles.filter((item) => !item.id);
			const itemsToUpdate = roles.filter((item) => !!item.id);
			const incomingIds = itemsToUpdate.map((item) => item.id!);
			const insertedIds: Array<number> = [];
			await this.repo.runInTransaction(async (tx) => {
				// 1. INSERT - new items (no id)
				if (itemsToInsert.length > 0) {
					const res = await this.repo.insertRoles(tx, itemsToInsert);
					insertedIds.push(...res.map(({ id }: { id: number }) => id));
				}

				// 2. UPSERT - existing items (with id)
				if (itemsToUpdate.length > 0) {
					await this.repo.upsertRoles(tx, itemsToUpdate);
				}

				// 3. DELETE - items not in the incoming array
				await this.repo.deleteRolesExcept(tx, data.performanceId, incomingIds, insertedIds);
			});
		}
	}
}
