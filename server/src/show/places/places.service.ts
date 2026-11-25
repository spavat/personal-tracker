import type { PlaceListResponse } from "@personal-tracker/shared/show";

import { Injectable, Logger } from "@nestjs/common";

import type { SavePlaceBody } from "./place.entity.js";

import { NotFoundError } from "../../common/errors.js";
import { toPerformanceView } from "../performances/performance.entity.js";
import { PlacesRepository } from "./places.repository.js";

@Injectable()
export class PlacesService {
	private readonly logger = new Logger(PlacesService.name);

	constructor(private readonly repo: PlacesRepository) {}

	async list(sort: string[] | undefined) {
		this.logger.log("list");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		const places = await this.repo.findAll({ sortField, sortDirection });
		return places as Array<PlaceListResponse>;
	}

	async get({ placeId, groupBySpectacle }: { placeId: string; groupBySpectacle: boolean }) {
		this.logger.log("get");
		const placeData = await this.repo.findByIdWithPerformances(placeId);
		if (!placeData) return null;

		const stats = {
			nbSpectacles: 0,
			nbPerformances: placeData?.performance?.filter((p) => !p.canceled).length ?? 0,
			lastPerformance: placeData?.performance?.at(-1)?.date ?? "",
		};
		let groups;
		const uniqueShows = new Set<string>();
		if (groupBySpectacle) {
			const spectacles: Record<string, any> = {};
			placeData?.performance?.forEach((perf) => {
				const spectacleId = perf.spectacleId;
				if (!perf.canceled) {
					uniqueShows.add(perf.spectacleId);
				}
				if (!spectacles[spectacleId]) {
					spectacles[spectacleId] = perf.spectacle;
					spectacles[spectacleId].performances = [];
				}
				spectacles[spectacleId].performances.push(toPerformanceView(perf));
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
						return toPerformanceView(perf);
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

	async save(data: SavePlaceBody) {
		this.logger.log("save");
		return (await this.repo.save(data)) ?? null;
	}

	async delete(id: string) {
		this.logger.log("delete");
		if (!(await this.repo.delete(id))) {
			throw new NotFoundError("place");
		}
	}
}
