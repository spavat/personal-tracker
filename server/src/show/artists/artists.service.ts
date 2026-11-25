import type { ArtistListResponse } from "@personal-tracker/shared/show";

import { Injectable, Logger } from "@nestjs/common";

import { toPerformanceView } from "../performances/performance.entity.js";
import { toArtistView } from "./artist.entity.js";
import { ArtistsRepository } from "./artists.repository.js";

@Injectable()
export class ArtistsService {
	private readonly logger = new Logger(ArtistsService.name);

	constructor(private readonly repo: ArtistsRepository) {}

	async list(sort: string[] | undefined) {
		this.logger.log("list");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		const artists = await this.repo.findAll({ sortField, sortDirection });
		return artists.map(({ nbPerformances, nbSpectacles, ...artist }): ArtistListResponse => ({
			...toArtistView(artist),
			nbPerformances,
			nbSpectacles,
		}));
	}

	async get({ artistId, groupBySpectacle }: { artistId: string; groupBySpectacle: boolean }) {
		this.logger.log("get");
		const artistData = await this.repo.findByIdWithPerformances(artistId);
		if (!artistData) {
			return null;
		}

		const stats = {
			nbSpectacles: 0,
			nbPerformances: 0,
			lastPerformance: "",
		};
		let groups;
		if (groupBySpectacle) {
			const spectacles: Record<string, any> = {};
			artistData.showRoles.forEach((role) => {
				const spectacleId = role.performance?.spectacleId ?? "";
				if (!spectacles[spectacleId]) {
					spectacles[spectacleId] = role.performance?.spectacle;
					spectacles[spectacleId].performances = [];
				}
				spectacles[spectacleId].performances.push({
					...toPerformanceView(role.performance!),
					role: role.name ?? "",
				});
			});
			groups = Object.values(spectacles);
			stats.nbSpectacles = groups.length;
			stats.nbPerformances = artistData.showRoles.length;
			stats.lastPerformance = artistData.showRoles.at(-1)?.performance?.date ?? "";
		} else {
			const uniqueShows = new Set<string>();
			groups = [
				{
					performances: artistData.showRoles.map((role) => {
						uniqueShows.add(role.performance?.spectacleId ?? "");
						return { ...toPerformanceView(role.performance!), role: role.name ?? "" };
					}),
				},
			];
			stats.nbSpectacles = uniqueShows.size;
			stats.nbPerformances = artistData.showRoles.length;
			stats.lastPerformance = groups[0].performances.at(-1)?.date ?? "";
		}

		return {
			...toArtistView(artistData),
			kind: artistData.kind,
			sortName: artistData.sortName,
			groups: Object.values(groups).toSorted((a, b) =>
				(a.performances?.[0]?.date ?? "").localeCompare(b.performances?.[0]?.date ?? ""),
			),
			stats,
		};
	}
}
