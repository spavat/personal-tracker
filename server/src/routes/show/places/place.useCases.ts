import type { PlaceListResponse } from "@personal-tracker/shared/show";
import type { FastifyBaseLogger } from "fastify";

import type { SavePlaceBody } from "./place.entity";
import type { PlaceRepository } from "./place.repository";

export class ListPlacesUseCase {
	constructor(private repo: PlaceRepository) {}

	async execute(sort: string[] | undefined, log: FastifyBaseLogger) {
		log.info("ListPlacesUseCase.execute");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		const places = await this.repo.findAll({ sortField, sortDirection });
		return places as Array<PlaceListResponse>;
	}
}

export class GetPlaceUseCase {
	constructor(private repo: PlaceRepository) {}

	async execute(
		{ placeId, groupBySpectacle }: { placeId: number; groupBySpectacle: boolean },
		log: FastifyBaseLogger,
	) {
		log.info("GetPlaceUseCase.execute");
		const placeData = await this.repo.findByIdWithPerformances(placeId);
		if (!placeData) return null;

		const stats = {
			nbSpectacles: 0,
			nbPerformances: placeData?.performance?.filter((p) => !p.canceled).length ?? 0,
			lastPerformance: placeData?.performance?.at(-1)?.date ?? "",
		};
		let groups;
		const uniqueShows = new Set<number>();
		if (groupBySpectacle) {
			const spectacles: Record<number, any> = {};
			placeData?.performance?.forEach((perf) => {
				const spectacleId = perf.spectacleId ?? 0;
				if (!perf.canceled) {
					uniqueShows.add(perf.spectacleId);
				}
				if (!spectacles[spectacleId]) {
					spectacles[spectacleId] = perf.spectacle;
					spectacles[spectacleId].performances = [];
				}
				spectacles[spectacleId].performances.push({
					id: perf.id,
					date: perf.date,
					canceled: perf.canceled,
					seat: perf.seat,
					placeId: perf.place?.id,
					placeName: perf.placeName,
					placeCountry: perf.place?.country,
					spectacleId: perf.spectacle?.id,
					spectacleName: perf.spectacle?.name,
				});
			});
			groups = Object.values(spectacles);
			stats.nbSpectacles = groups.length;
		} else {
			groups = [
				{
					performances: placeData?.performance?.map((perf) => {
						if (!perf.canceled) {
							uniqueShows.add(perf.spectacleId);
						}
						return {
							id: perf.id,
							date: perf.date,
							canceled: perf.canceled,
							seat: perf.seat,
							placeId: perf.place?.id,
							placeName: perf.placeName,
							placeCountry: perf.place?.country,
							spectacleId: perf.spectacle?.id,
							spectacleName: perf.spectacle?.name,
						};
					}),
				},
			];
		}
		stats.nbSpectacles = uniqueShows.size;

		const { id, name, address, country, link, formerNames } = placeData ?? {};
		return {
			id,
			name,
			address,
			country,
			link,
			formerNames: formerNames?.map(({ name, untilDate }) => ({ name, untilDate })) ?? [],
			groups: groups.toSorted((a, b) =>
				(a.performances?.[0]?.date ?? "").localeCompare(b.performances?.[0]?.date ?? ""),
			),
			stats,
		};
	}
}

export class SavePlaceUseCase {
	constructor(private repo: PlaceRepository) {}

	async execute(data: SavePlaceBody, log: FastifyBaseLogger) {
		log.info("SavePlaceUseCase.execute");
		await this.repo.save(data);
		return { ok: true };
	}
}

export class DeletePlaceUseCase {
	constructor(private repo: PlaceRepository) {}

	async execute(id: number, log: FastifyBaseLogger) {
		log.info("DeletePlaceUseCase.execute");
		await this.repo.delete(id);
		return { ok: true };
	}
}
