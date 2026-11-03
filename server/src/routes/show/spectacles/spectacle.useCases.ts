import type { SpectacleDetailsResponse, SpectacleListResponse } from "@shared/dist/schemas/show.schema";
import type { FastifyBaseLogger } from "fastify";

import type { SaveSpectacleBody } from "./spectacle.entity";
import type { SpectacleRepository } from "./spectacle.repository";

import { sortByMediaOrder, toSpectacleMedia } from "../media/media.entity";
import { toModelView } from "../models/model.entity";
import { toPerformanceView } from "../performances/performance.entity";

export class ListSpectaclesUseCase {
	constructor(private repo: SpectacleRepository) {}

	async execute(log: FastifyBaseLogger): Promise<SpectacleListResponse> {
		log.info("ListSpectaclesUseCase.execute");
		const spectacles = await this.repo.findAll();
		return spectacles;
	}
}

export class GetGroupedSpectaclesUseCase {
	constructor(private repo: SpectacleRepository) {}

	async execute(groupByYear: boolean, log: FastifyBaseLogger) {
		log.info("GetGroupedSpectaclesUseCase.execute");
		const spectacles = await this.repo.findAllWithPerformancesAndPlaces();
		if (!spectacles) {
			return {};
		}

		const tempResults: Record<string, any> = {};
		const limits = { start: 0, end: 0 };
		spectacles.forEach((spectacle) => {
			spectacle.performance?.forEach((perf) => {
				if (!perf.place || !perf.placeId) {
					return;
				}

				// Update limits
				const currentYear = parseInt((perf.date ?? "").substring(0, 4), 10);
				if (!limits.start) {
					limits.start = currentYear;
				}
				if (!limits.end) {
					limits.end = currentYear;
				}
				if (limits.start > currentYear) {
					limits.start = currentYear;
				}
				if (limits.end < currentYear) {
					limits.end = currentYear;
				}

				// Group by year
				const yearKey = groupByYear ? (perf.date ?? "").substring(0, 4) : "all";

				if (!tempResults[yearKey]) {
					tempResults[yearKey] = {
						name: yearKey,
						nbPerformances: 0,
						nbSpectacles: 0,
						spectacles: {},
					};
				}
				if (!perf.canceled) {
					tempResults[yearKey].nbPerformances++;
				}

				if (!tempResults[yearKey].spectacles[spectacle.id]) {
					tempResults[yearKey].spectacles[spectacle.id] = {
						id: spectacle.id,
						name: spectacle.name,
						nbPerformances: 0,
						places: {},
					};
				}
				if (!perf.canceled) {
					// Counted on its first performance not canceled, whatever the order
					if (tempResults[yearKey].spectacles[spectacle.id].nbPerformances === 0) {
						tempResults[yearKey].nbSpectacles++;
					}
					tempResults[yearKey].spectacles[spectacle.id].nbPerformances++;
				}

				// A renamed place is listed once per name
				const placeKey = `${perf.placeId}-${perf.placeName}`;
				if (!tempResults[yearKey].spectacles[spectacle.id].places[placeKey]) {
					tempResults[yearKey].spectacles[spectacle.id].places[placeKey] = {
						...perf.place,
						name: perf.placeName,
					};
					tempResults[yearKey].spectacles[spectacle.id].places[placeKey].performances = [];
				}
				tempResults[yearKey].spectacles[spectacle.id].places[placeKey].performances.push({
					id: perf.id,
					date: perf.date,
					canceled: perf.canceled,
				});
			});
		});

		return Object.entries(tempResults)
			.map(([keyYear, valuesYear]) => {
				return {
					id: keyYear,
					name: keyYear === "all" ? `${limits.start} - ${limits.end}` : keyYear,
					nbPerformances: valuesYear.nbPerformances,
					nbSpectacles: valuesYear.nbSpectacles,
					spectacles: Object.entries(valuesYear.spectacles)
						.map(([keySpec, valuesSpec]: [string, any]) => {
							return {
								id: keySpec,
								name: valuesSpec.name,
								nbPerformances: valuesSpec.nbPerformances,
								places: Object.entries(valuesSpec.places).map(
									([keyPlace, valuesPlace]: [string, any]) => {
										return {
											id: keyPlace,
											...valuesPlace,
										};
									},
								),
							};
						})
						.toSorted((a, b) => {
							if (a.nbPerformances === b.nbPerformances) {
								return a.places[0].performances[0].date.localeCompare(b.places[0].performances[0].date);
							}
							return b.nbPerformances - a.nbPerformances;
						}),
				};
			})
			.toSorted((a, b) => b.name.localeCompare(a.name));
	}
}

export class GetSpectacleUseCase {
	constructor(private repo: SpectacleRepository) {}

	async execute(id: number, log: FastifyBaseLogger): Promise<SpectacleDetailsResponse | null> {
		log.info("GetSpectacleUseCase.execute");
		const spec = await this.repo.findByIdWithDetails(id);
		if (!spec) {
			return null;
		}
		return {
			id: spec.id,
			name: spec.name,
			workId: spec.workId,
			description: spec.description,
			descriptionSource: spec.descriptionSource,
			links: spec.links,
			tracklist: spec.tracklist,
			performances: (spec.performance ?? []).map((perf) => toPerformanceView({ ...perf, spectacle: spec })),
			models: (spec.models ?? []).map(toModelView),
			media: sortByMediaOrder(spec.mediaLinks ?? []).map(toSpectacleMedia),
		};
	}
}

export class SaveSpectacleUseCase {
	constructor(private repo: SpectacleRepository) {}

	async execute(data: SaveSpectacleBody, log: FastifyBaseLogger) {
		log.info("SaveSpectacleUseCase.execute");
		return (await this.repo.save(data)) ?? null;
	}
}
