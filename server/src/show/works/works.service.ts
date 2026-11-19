import type { WorkListResponse } from "@personal-tracker/shared/show";

import { Injectable, Logger } from "@nestjs/common";

import type { SaveWorkBody } from "./work.entity.js";

import { NotFoundError } from "../../common/errors.js";
import { WorksRepository } from "./works.repository.js";

@Injectable()
export class WorksService {
	private readonly logger = new Logger(WorksService.name);

	constructor(private readonly repo: WorksRepository) {}

	async list(): Promise<WorkListResponse> {
		this.logger.log("list");
		return this.repo.findAll();
	}

	async listGrouped(groupByYear: boolean) {
		this.logger.log("listGrouped");
		const works = await this.repo.findAllWithSpectaclesPerformancesAndPlaces();
		if (!works) {
			return {};
		}

		const tempResults: Record<string, any> = {};
		const limits = { start: 0, end: 0 };

		works.forEach((work) => {
			work.spectacle.forEach((spectacle) => {
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
							nbWorks: 0,
							works: {},
						};
					}
					if (!perf.canceled) {
						tempResults[yearKey].nbPerformances++;
					}

					if (!tempResults[yearKey].works[work.id]) {
						tempResults[yearKey].works[work.id] = {
							id: work.id,
							name: work.name,
							nbPerformances: 0,
							nbSpectacles: 0,
							spectacles: {},
						};
					}

					if (!tempResults[yearKey].works[work.id].spectacles[spectacle.id]) {
						tempResults[yearKey].works[work.id].spectacles[spectacle.id] = {
							id: spectacle.id,
							name: spectacle.name,
							nbPerformances: 0,
							places: {},
						};
					}
					if (!perf.canceled) {
						// Counted on their first performance not canceled, whatever the order
						if (tempResults[yearKey].works[work.id].nbPerformances === 0) {
							tempResults[yearKey].nbWorks++;
						}
						if (tempResults[yearKey].works[work.id].spectacles[spectacle.id].nbPerformances === 0) {
							tempResults[yearKey].works[work.id].nbSpectacles++;
							tempResults[yearKey].nbSpectacles++;
						}
						tempResults[yearKey].works[work.id].spectacles[spectacle.id].nbPerformances++;
						tempResults[yearKey].works[work.id].nbPerformances++;
					}

					// A renamed place is listed once per name
					const placeKey = `${perf.placeId}-${perf.placeName}`;
					if (!tempResults[yearKey].works[work.id].spectacles[spectacle.id].places[placeKey]) {
						tempResults[yearKey].works[work.id].spectacles[spectacle.id].places[placeKey] = {
							...perf.place,
							name: perf.placeName,
						};
						tempResults[yearKey].works[work.id].spectacles[spectacle.id].places[placeKey].performances = [];
					}
					tempResults[yearKey].works[work.id].spectacles[spectacle.id].places[placeKey].performances.push({
						id: perf.id,
						date: perf.date,
						canceled: perf.canceled,
					});
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
					nbWorks: valuesYear.nbWorks,
					works: Object.entries(valuesYear.works)
						.map(([keyWork, valuesWork]: [string, any]) => {
							return {
								id: keyWork,
								name: valuesWork.name,
								nbPerformances: valuesWork.nbPerformances,
								nbSpectacles: valuesWork.nbSpectacles,
								spectacles: Object.entries(valuesWork.spectacles)
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
											return a.places[0].performances[0].date.localeCompare(
												b.places[0].performances[0].date,
											);
										}
										return b.nbPerformances - a.nbPerformances;
									}),
							};
						})
						.toSorted((a, b) => {
							// if (a.nbPerformances === b.nbPerformances) {
							// 	console.log("a.places[0]", a.places[0],  "---", b.places)
							// 	return a.places[0].performances[0].date.localeCompare(b.places[0].performances[0].date)
							// }
							return b.nbPerformances - a.nbPerformances;
						}),
				};
			})
			.toSorted((a, b) => b.name.localeCompare(a.name));
	}

	get(id: number) {
		this.logger.log("get");
		return this.repo.findByIdWithSpectacles(id);
	}

	async save(data: SaveWorkBody) {
		this.logger.log("save");
		return (await this.repo.save(data)) ?? null;
	}

	async delete(id: number) {
		this.logger.log("delete");
		if (!(await this.repo.delete(id))) {
			throw new NotFoundError("work");
		}
	}
}
