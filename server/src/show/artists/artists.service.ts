import type { ArtistListResponse } from "@personal-tracker/shared/show";

import { Injectable, Logger } from "@nestjs/common";

import { NotFoundError } from "../../common/errors.js";
import { sortByMediaOrder, toArtistMedia } from "../media/media.entity.js";
import { toPerformanceView } from "../performances/performance.entity.js";
import { type SaveArtistBody, toArtistView } from "./artist.entity.js";
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

	async get({ artistId, groupBySpectacle }: { artistId: number; groupBySpectacle: boolean }) {
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

	async save(data: SaveArtistBody) {
		this.logger.log("save");
		const artist = await this.repo.save(data);
		return artist ? toArtistView(artist) : null;
	}

	async delete(id: number) {
		this.logger.log("delete");
		if (!(await this.repo.delete(id))) {
			throw new NotFoundError("artist");
		}
	}
}
