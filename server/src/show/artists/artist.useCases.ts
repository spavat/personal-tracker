import type { ArtistListResponse, SaveArtistBodyRequest } from "@personal-tracker/shared/show";

import { Injectable } from "@nestjs/common";

import type { UseCaseLog } from "../../common/use-case-log.js";

import { sortByMediaOrder, toArtistMedia } from "../media/media.entity.js";
import { toPerformanceView } from "../performances/performance.entity.js";
import { toArtistView } from "./artist.entity.js";
import { ArtistRepository } from "./artist.repository.js";

@Injectable()
export class ListArtistsUseCase {
	constructor(private repo: ArtistRepository) {}

	async execute(sort: string[] | undefined, log: UseCaseLog) {
		log.info("ListArtistsUseCase.execute");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		const artists = await this.repo.findAll({ sortField, sortDirection });
		return artists.map(({ nbPerformances, nbSpectacles, ...artist }): ArtistListResponse => ({
			...toArtistView(artist),
			nbPerformances,
			nbSpectacles,
		}));
	}
}

@Injectable()
export class GetArtistUseCase {
	constructor(private repo: ArtistRepository) {}

	async execute({ artistId, groupBySpectacle }: { artistId: number; groupBySpectacle: boolean }, log: UseCaseLog) {
		log.info("GetArtistUseCase.execute");
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
			const spectacles: Record<number, any> = {};
			artistData?.role?.forEach((role) => {
				const spectacleId = role.performance?.spectacleId ?? 0;
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
			stats.nbPerformances = artistData?.role?.length;
			stats.lastPerformance = artistData?.role.at(-1)?.performance?.date ?? "";
		} else {
			const uniqueShows = new Set<number>();
			groups = [
				{
					performances: artistData?.role?.map((role) => {
						uniqueShows.add(role.performance?.spectacleId ?? 0);
						return { ...toPerformanceView(role.performance!), role: role.name ?? "" };
					}),
				},
			];
			stats.nbSpectacles = uniqueShows.size;
			stats.nbPerformances = artistData?.role?.length;
			stats.lastPerformance = groups[0].performances.at(-1)?.date ?? "";
		}

		return {
			...toArtistView(artistData),
			media: sortByMediaOrder(artistData.mediaLinks ?? []).map(toArtistMedia),
			groups: Object.values(groups).toSorted((a, b) =>
				(a.performances?.[0]?.date ?? "").localeCompare(b.performances?.[0]?.date ?? ""),
			),
			stats,
		};
	}
}

@Injectable()
export class SaveArtistUseCase {
	constructor(private repo: ArtistRepository) {}

	async execute(data: SaveArtistBodyRequest, log: UseCaseLog) {
		log.info("SaveArtistUseCase.execute");
		const artist = await this.repo.save(data);
		return artist ? toArtistView(artist) : null;
	}
}

@Injectable()
export class DeleteArtistUseCase {
	constructor(private repo: ArtistRepository) {}

	async execute(id: number, log: UseCaseLog) {
		log.info("DeleteArtistUseCase.execute");
		await this.repo.delete(id);
	}
}
