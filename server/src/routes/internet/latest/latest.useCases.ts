import type {
	LatestEpisodesResponse,
	LatestGenericQuerystringRequest,
	RefIdsEnum,
} from "@personal-tracker/shared/internet";
import type { FastifyBaseLogger } from "fastify";

import type { InternetRepository } from "../internet.repository";
import type { LatestEpisodesCacheRepository } from "../latest-episodes-cache.repository";

import { fetchLatestEpisodes } from "../fetch-latest";

export class GetLatestEpisodesUseCase {
	async execute(
		{ url, type }: LatestGenericQuerystringRequest,
		log: FastifyBaseLogger,
	): Promise<LatestEpisodesResponse> {
		log.info("GetLatestEpisodesUseCase.execute");
		if (!url || !type) throw new Error("Config invalide");

		try {
			const response = await fetchLatestEpisodes(url, type);
			return {
				dateTimeUtc: Temporal.Now.plainDateTimeISO().toString({ fractionalSecondDigits: 0 }),
				type,
				latestEpisodes: response,
			};
		} catch (e) {
			console.log(e);
			console.log("Can't retrieve latest episodes for", url);
			throw new Error("Impossible de récupérer les derniers épisodes");
		}
	}
}

export class GetLatestEpisodesForProgramUseCase {
	constructor(
		private repo: InternetRepository,
		private cache: LatestEpisodesCacheRepository,
	) {}

	async execute(
		programId: string,
		force: RefIdsEnum | undefined,
		log: FastifyBaseLogger,
	): Promise<LatestEpisodesResponse> {
		log.info("GetLatestEpisodesForProgramUseCase.execute");
		if (!force) {
			const cached = this.cache.get(programId);
			if (cached) {
				const cachedInstant = Temporal.PlainDateTime.from(cached.dateTimeUtc)
					.toZonedDateTime("UTC")
					.toInstant();
				const nowInstant = Temporal.Now.instant();
				const diff = nowInstant.since(cachedInstant, { largestUnit: "hours" });
				if (diff.total({ unit: "hours" }) < 2) {
					console.log("ALREADY IN CACHE");
					return cached;
				}
				console.log("ALREADY IN CACHE but too old, refetch", diff);
			}
		}

		const res = await this.repo.findById(programId);

		let url = "";
		let type: RefIdsEnum | null = null;
		if (force) {
			if (force === "rss") {
				url = res?.refs?.rss ?? "";
				type = "rss";
			} else if (force === "youtubePlaylistId") {
				url = res?.refs?.youtubePlaylistId ?? "";
				type = "youtubePlaylistId";
			} else if (force === "youtubeChannelId") {
				url = res?.refs?.youtubeChannelId ?? "";
				type = "youtubeChannelId";
			}
		} else {
			if (res?.refs?.rss) {
				url = res.refs.rss;
				type = "rss";
			} else if (res?.refs?.youtubePlaylistId) {
				url = res.refs.youtubePlaylistId;
				type = "youtubePlaylistId";
			} else if (res?.refs?.youtubeChannelId) {
				url = res.refs.youtubeChannelId;
				type = "youtubeChannelId";
			}
		}

		if (!type || !url) throw new Error("Config invalide");

		const viewEpisodesByExternalId: Record<string, boolean> =
			res?.episodes.reduce((acc: Record<string, boolean>, episode) => {
				if (episode.externalId) {
					acc[episode.externalId] = true;
				}
				return acc;
			}, {}) ?? {};

		try {
			const response = await fetchLatestEpisodes(url, type);
			const responseObject = {
				dateTimeUtc: Temporal.Now.plainDateTimeISO().toString({ fractionalSecondDigits: 0 }),
				type,
				latestEpisodes: response.map((episode) => {
					episode.view = Boolean(episode.id && viewEpisodesByExternalId[episode.id]);
					return episode;
				}),
			};

			if (response.length) this.cache.set(programId, responseObject);
			return responseObject;
		} catch (e) {
			console.log(e);
			console.log("Can't retrieve latest episode", { id: res?.id, name: res?.name });
			throw new Error("Impossible de récupérer les derniers épisodes");
		}
	}
}
