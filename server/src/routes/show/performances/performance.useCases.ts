import type { PerformanceView } from "@personal-tracker/shared/show";
import type { FastifyBaseLogger } from "fastify";

import { httpErrors } from "@fastify/sensible";

import type { SaveCastingBody, SavePerformanceBody } from "./performance.entity";
import type { PerformanceRepository } from "./performance.repository";

import { toModelView } from "../models/model.entity";
import { toPerformanceView } from "./performance.entity";

export class ListPerformancesUseCase {
	constructor(private repo: PerformanceRepository) {}

	async execute(
		{ from, to }: { from?: string; to?: string },
		log: FastifyBaseLogger,
	): Promise<Array<PerformanceView>> {
		log.info("ListPerformancesUseCase.execute");
		const performances = await this.repo.findAllWithDetails({ from, to });
		return performances.map(toPerformanceView);
	}
}

export class GetPerformanceUseCase {
	constructor(private repo: PerformanceRepository) {}

	async execute(performanceId: number, log: FastifyBaseLogger) {
		log.info("GetPerformanceUseCase.execute");
		const performance = await this.repo.findByIdWithDetails(performanceId);
		if (!performance) return null;
		// the details also need the spectacle models, for the casting form
		const { models, ...spectacle } = performance.spectacle!;
		return { ...toPerformanceView(performance), spectacle: { ...spectacle, models: models.map(toModelView) } };
	}
}

export class SavePerformanceUseCase {
	constructor(private repo: PerformanceRepository) {}

	async execute(body: SavePerformanceBody, log: FastifyBaseLogger) {
		log.info("SavePerformanceUseCase.execute");
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
					throw httpErrors.badRequest("L'affiche doit être un média « affiche » de ce spectacle");
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
				throw httpErrors.notFound("Représentation introuvable");
			}
			return saved;
		});
	}
}

export class SaveCastingUseCase {
	constructor(private repo: PerformanceRepository) {}

	async execute(data: SaveCastingBody, log: FastifyBaseLogger) {
		log.info("SaveCastingUseCase.execute");
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
