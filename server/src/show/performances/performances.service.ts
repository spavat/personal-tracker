import type { PerformanceView } from "@personal-tracker/shared/show";

import { Injectable, Logger } from "@nestjs/common";

import type { SaveCastingBody, SavePerformanceBody } from "./performance.entity.js";

import { BadRequestError, NotFoundError } from "../../common/errors.js";
import { toModelView } from "../models/model.entity.js";
import { toPerformanceView } from "./performance.entity.js";
import { PerformancesRepository } from "./performances.repository.js";

@Injectable()
export class PerformancesService {
	private readonly logger = new Logger(PerformancesService.name);

	constructor(private readonly repo: PerformancesRepository) {}

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

	async get(performanceId: string) {
		this.logger.log("get");
		const performance = await this.repo.findByIdWithDetails(performanceId);
		if (!performance) return null;
		// the details also need the spectacle models, for the casting form
		const { models, ...spectacle } = performance.spectacle!;
		return { ...toPerformanceView(performance), spectacle: { ...spectacle, models: models.map(toModelView) } };
	}

	// `id`: the performance updated (none: created)
	async save(body: SavePerformanceBody, id?: string) {
		this.logger.log("save");
		const { work, spectacle, place, performance } = body;

		return this.repo.runInTransaction(async (tx) => {
			let placeId = performance.placeId;
			if (!placeId && place) {
				placeId = await this.repo.insertPlace(tx, place);
			}

			let spectacleId = performance.spectacleId;
			if (!spectacleId && spectacle) {
				let workId = spectacle.workId;
				if (!workId && work) {
					workId = await this.repo.insertWork(tx, work);
				}
				spectacleId = await this.repo.insertSpectacle(tx, {
					name: spectacle.name,
					workId: workId!,
				});
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
			const [saved] = await this.repo.savePerformance(tx, id, dataToSave);
			if (!saved) {
				// rolls back the place, work and spectacle created above
				throw new NotFoundError("performance");
			}
			return saved;
		});
	}

	async delete(id: string) {
		this.logger.log("delete");
		await this.repo.runInTransaction(async (tx) => {
			const [deleted] = await this.repo.delete(tx, id);
			if (!deleted) {
				throw new NotFoundError("performance");
			}
		});
	}

	async saveCasting(performanceId: string, data: SaveCastingBody) {
		this.logger.log("saveCasting");
		if (data) {
			const roles = data.roles.map((r) => ({ ...r, performanceId }));
			const itemsToInsert = roles.filter((item) => !item.id);
			const itemsToUpdate = roles.filter((item) => !!item.id);
			const incomingIds = itemsToUpdate.map((item) => item.id!);
			const insertedIds: Array<string> = [];
			await this.repo.runInTransaction(async (tx) => {
				// 1. INSERT - new items (no id)
				if (itemsToInsert.length > 0) {
					const res = await this.repo.insertRoles(tx, itemsToInsert);
					insertedIds.push(...res.map(({ id }: { id: string }) => id));
				}

				// 2. UPSERT - existing items (with id)
				if (itemsToUpdate.length > 0) {
					await this.repo.upsertRoles(tx, itemsToUpdate);
				}

				// 3. DELETE - items not in the incoming array
				await this.repo.deleteRolesExcept(tx, performanceId, incomingIds, insertedIds);
			});
		}
	}
}
