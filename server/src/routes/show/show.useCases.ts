import type { FastifyBaseLogger } from "fastify";

import type { ArtistRepository } from "./artists/artist.repository";
import type { PerformanceRepository } from "./performances/performance.repository";
import type { PlaceRepository } from "./places/place.repository";
import type { SpectacleRepository } from "./spectacles/spectacle.repository";

export class ShowUseCase {
	constructor(
		private spectacleRepo: SpectacleRepository,
		private artistRepo: ArtistRepository,
		private placeRepo: PlaceRepository,
	) {}

	async execute(search: string, log: FastifyBaseLogger) {
		log.info("ShowUseCase.execute");
		if (!search) {
			return [];
		}
		const spectacles = await this.spectacleRepo.findByName(search);
		const artists = await this.artistRepo.findByName(search);
		const places = await this.placeRepo.findByName(search);

		return [
			...spectacles.map((spectacle) => {
				return {
					...spectacle,
					description: `${spectacle.performance.length} représentations`,
					type: "spectacle",
				};
			}),
			...artists.map((artist) => {
				return { ...artist, description: `${artist.role.length} représentations`, type: "artist" };
			}),
			...places.map((s) => ({ ...s, type: "place" })),
		];
	}
}

export class GetReportUseCase {
	constructor(private repo: PerformanceRepository) {}

	private calculateRank(items: Array<any>) {
		let rank = 0;
		let prevScore: number | null = null;

		return items.map((item, index) => {
			if (item.count !== prevScore) {
				rank = index + 1; // rank = position in sorted array (1-based)
				prevScore = item.count;
			}
			return { ...item, rank };
		});
	}

	private sortSpectacle(record: Record<string, any>) {
		return Object.values(record).toSorted((a, b) => {
			if (b.count === a.count) {
				return a.date.localeCompare(b.date);
			}
			return b.count - a.count;
		});
	}

	private takeWithTiesKept<T extends { rank: number }>(items: T[], minCount: number): T[] {
		if (items.length <= minCount) return items;

		const lastKeptRank = items[minCount - 1].rank;
		const cutIndex = items.findIndex((item, i) => i >= minCount && item.rank !== lastKeptRank);

		return cutIndex === -1 ? items : items.slice(0, cutIndex);
	}

	async execute({ from, to }: { from: string; to: string }, log: FastifyBaseLogger) {
		log.info("GetReportUseCase.execute");
		const performances = await this.repo.findAll({ to });

		let counts = {
			spectacles: 0,
			performances: 0,
			newSpectacles: 0,
		};
		const spectaclesInPeriod: Record<string, any> = {};
		const allSpectacles: Record<string, any> = {};
		const countryDistribution: Record<string, number> = {};
		let allSpectaclesBeforePeriod: Record<string, any> = {};
		let foundTreshold = false;
		for (let performance of performances) {
			if (performance.canceled || !performance.spectacleId) {
				continue;
			}

			const isInPeriod = from <= performance.date && performance.date <= to;
			if (isInPeriod && !foundTreshold) {
				// First performance in period, clone current allSpectacles in allSpectaclesBeforePeriod
				allSpectaclesBeforePeriod = structuredClone(allSpectacles);
				foundTreshold = true;
			}

			// global
			if (!allSpectacles[performance.spectacleId]) {
				allSpectacles[performance.spectacleId] = {
					id: performance.spectacleId,
					name: performance.spectacle,
					date: performance.date,
					count: 0,
					added: 0,
					move: "",
					isNew: isInPeriod,
				};
			}
			allSpectacles[performance.spectacleId].count += 1;

			// in period
			if (isInPeriod) {
				if (!spectaclesInPeriod[performance.spectacleId]) {
					const isNew = !allSpectaclesBeforePeriod[performance.spectacleId];
					spectaclesInPeriod[performance.spectacleId] = {
						id: performance.spectacleId,
						name: performance.spectacle,
						count: 0,
						date: performance.date,
						isNew,
					};
					counts.spectacles += 1;
					if (isNew) {
						counts.newSpectacles += 1;
					}
				}
				spectaclesInPeriod[performance.spectacleId].count += 1;
				allSpectacles[performance.spectacleId].added += 1;
				counts.performances += 1;

				const country = performance.country ?? "fr";
				if (!countryDistribution[country]) {
					countryDistribution[country] = 0;
				}
				countryDistribution[country] += 1;
			}
		}
		const previousRankingMap = this.calculateRank(this.sortSpectacle(allSpectaclesBeforePeriod)).reduce(
			(acc, item) => ({
				...acc,
				[item.id]: item.rank,
			}),
			{},
		);

		return {
			hasData: performances.length > 0,
			stats: {
				spectacles: counts.spectacles,
				performances: counts.performances,
				newSpectacles: counts.newSpectacles,
				countryDistribution: Object.entries(countryDistribution)
					.map(([key, count]) => ({ code: key, count }))
					.toSorted((a, b) => b.count - a.count),
			},
			periodList: this.calculateRank(this.sortSpectacle(spectaclesInPeriod)),
			totalList: this.takeWithTiesKept(
				this.calculateRank(this.sortSpectacle(allSpectacles)).map((item) => {
					const previousRank = previousRankingMap[item.id];
					const currentRank = item.rank;
					if (previousRank > currentRank) {
						item.move = "up";
					} else if (previousRank < currentRank) {
						item.move = "down";
					} else {
						item.move = "";
					}
					return item;
				}),
				10,
			),
		};
	}
}
