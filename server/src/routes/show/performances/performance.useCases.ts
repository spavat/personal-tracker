import type { PerformanceListResponse } from "@personal-tracker/shared/show";
import type { FastifyBaseLogger } from "fastify";

import type { SaveCastingBody, SavePerformanceBody } from "./performance.entity";
import type { PerformanceRepository } from "./performance.repository";

export class ListPerformancesUseCase {
	constructor(private repo: PerformanceRepository) {}

	async execute({ from, to }: { from?: string; to?: string }, log: FastifyBaseLogger) {
		log.info("ListPerformancesUseCase.execute");
		const performances = await this.repo.findAll({ from, to });
		return performances as Array<PerformanceListResponse>;
	}
}

export class GetPerformanceUseCase {
	constructor(private repo: PerformanceRepository) {}

	async execute(performanceId: number, log: FastifyBaseLogger) {
		log.info("GetPerformanceUseCase.execute");
		const performance = await this.repo.findByIdWithDetails(performanceId);
		if (!performance) return null;
		const { role, placeName, place, ...otherData } = performance;
		return {
			...otherData,
			place: place && { ...place, name: placeName },
			roles: (role ?? []).map((r) => {
				return {
					id: r.id,
					artistId: r.artistId,
					artistName: r.artist?.name,
					name: r.name,
					status: r.status,
					main: r.main,
				};
			}),
		};
	}
}

export class SavePerformanceUseCase {
	constructor(private repo: PerformanceRepository) {}

	async execute(body: SavePerformanceBody, log: FastifyBaseLogger) {
		log.info("SavePerformanceUseCase.execute");
		const { work, spectacle, place, performance } = body;

		await this.repo.runInTransaction(async (tx) => {
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
			const dataToSave = {
				date: performance.date,
				canceled: performance.canceled,
				seat: performance.seat,
				casting_status: performance.casting_status,
				casting_origin: performance.casting_origin,
				placeId,
				spectacleId: spectacleId!,
			};
			await this.repo.savePerformance(tx, performance.id, dataToSave);
		});

		return { ok: true };
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
		return { ok: true };
	}
}
