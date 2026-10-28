import type { ArtistListResponse, SaveArtistBodyRequest } from "@personal-tracker/shared/show";
import type { FastifyBaseLogger } from "fastify";

import type { ArtistRepository } from "./artist.repository";

export class ListArtistsUseCase {
	constructor(private repo: ArtistRepository) {}

	async execute(sort: string[] | undefined, log: FastifyBaseLogger) {
		log.info("ListArtistsUseCase.execute");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		const artists = await this.repo.findAll({ sortField, sortDirection });
		return artists as Array<ArtistListResponse>;
	}
}

export class GetArtistUseCase {
	constructor(private repo: ArtistRepository) {}

	async execute(
		{ artistId, groupBySpectacle }: { artistId: number; groupBySpectacle: boolean },
		log: FastifyBaseLogger,
	) {
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
					id: role.performance?.id,
					date: role.performance?.date,
					canceled: role.performance?.canceled,
					seat: role.performance?.seat,
					role: role.name,
					placeId: role.performance?.place?.id,
					placeName: role.performance?.placeName,
					placeCountry: role.performance?.place?.country,
					spectacleId: role.performance?.spectacle?.id,
					spectacleName: role.performance?.spectacle?.name,
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
						return {
							id: role.performance?.id,
							date: role.performance?.date,
							canceled: role.performance?.canceled,
							seat: role.performance?.seat,
							role: role.name,
							placeId: role.performance?.place?.id,
							placeName: role.performance?.placeName,
							placeCountry: role.performance?.place?.country,
							spectacleId: role.performance?.spectacle?.id,
							spectacleName: role.performance?.spectacle?.name,
						};
					}),
				},
			];
			stats.nbSpectacles = uniqueShows.size;
			stats.nbPerformances = artistData?.role?.length;
			stats.lastPerformance = groups[0].performances.at(-1)?.date ?? "";
		}

		const { id, name } = artistData ?? {};
		return {
			id,
			name,
			groups: Object.values(groups).toSorted((a, b) =>
				(a.performances?.[0]?.date ?? "").localeCompare(b.performances?.[0]?.date ?? ""),
			),
			stats,
		};
	}
}

export class SaveArtistUseCase {
	constructor(private repo: ArtistRepository) {}

	async execute(data: SaveArtistBodyRequest, log: FastifyBaseLogger) {
		log.info("SaveArtistUseCase.execute");
		await this.repo.save(data);
		return { ok: true };
	}
}

export class DeleteArtistUseCase {
	constructor(private repo: ArtistRepository) {}

	async execute(id: number, log: FastifyBaseLogger) {
		log.info("DeleteArtistUseCase.execute");
		await this.repo.delete(id);
		return { ok: true };
	}
}
