import type { LatestEpisodesResponse } from "@personal-tracker/shared/internet";

import { Logger } from "@nestjs/common";

import type { InternetImagesStorage } from "../internet-images.storage.js";
import type { InternetRepository } from "../internet.repository.js";
import type { LatestEpisodesCache } from "../latest-episodes.cache.js";
import type { ListenedEpisode } from "./sync.entity.js";
import type { SyncProposalMongo } from "./sync.repository.js";

import { fetchLatestEpisodes } from "../episode-feed.client.js";

function conv(duration: number) {
	const durationInSec = Math.round(duration / 1000);
	let result = "";
	const hours = Math.floor(durationInSec / (60 * 60));
	if (hours > 0) {
		result += `${hours}h `;
	}
	const minutes = Math.floor((durationInSec % (60 * 60)) / 60);
	if (minutes > 0) {
		result += `${minutes}min `;
	}
	const seconds = durationInSec % 60;
	if (seconds > 0) {
		result += `${seconds}sec `;
	}
	return result.trim();
}

// Latest saved episode with this external id (relistening): flagged on the proposal, never skipped
function findAlreadySaved(episodes: Array<{ externalId?: string; date: string }> | undefined, externalId: string) {
	const date = (episodes ?? [])
		.filter((episode) => episode.externalId !== undefined && String(episode.externalId) === String(externalId))
		.map((episode) => episode.date)
		.sort()
		.at(-1);
	return date ? { alreadySaved: { date } } : {};
}

// Built for one sync run (not a provider): it keeps the feeds already fetched during the run
export class SyncProposalBuilder {
	private readonly logger = new Logger(SyncProposalBuilder.name);

	constructor(
		private repo: InternetRepository,
		private cache: LatestEpisodesCache,
		private imageStorage: InternetImagesStorage,
		// When true, the shared cache is not read: latest episodes are refetched once per program for this run
		private forceRefresh = false,
	) {}

	private fetchedThisRun = new Map<string, LatestEpisodesResponse>();

	private async getLatestEpisodes(programId: string, rssUrl: string) {
		const cached =
			this.fetchedThisRun.get(programId) ?? (this.forceRefresh ? undefined : this.cache.get(programId));
		if (cached) return cached;

		const latestEpisodes = await fetchLatestEpisodes(rssUrl, "rss");
		const fetched: LatestEpisodesResponse = {
			dateTimeUtc: Temporal.Now.plainDateTimeISO().toString({ fractionalSecondDigits: 0 }),
			type: "rss",
			latestEpisodes,
		};
		this.fetchedThisRun.set(programId, fetched);
		if (latestEpisodes.length) this.cache.set(programId, fetched);
		return fetched;
	}

	async build(listened: ListenedEpisode): Promise<Omit<SyncProposalMongo, "id" | "listened">> {
		const localDatetime = Temporal.Instant.from(listened.listenedAtIso)
			.toZonedDateTimeISO("Europe/Paris")
			.toPlainDateTime();
		const origin = {
			program: listened.podcastTitle,
			episode: listened.episodeTitle,
			datetime: localDatetime.toString(),
			externalId: listened.episodeId,
			duration: conv(listened.duration),
			listened: conv(listened.playedDuration),
			percentListened: listened.percentListened,
		};

		const program = await this.repo.findByRssUrl(listened.podcastUrl);
		if (!program) {
			return { origin };
		}
		const programWithCover = this.imageStorage.resolveImages(program);
		const alreadySaved = findAlreadySaved(program.episodes, listened.episodeId);

		let latest: LatestEpisodesResponse;
		try {
			latest = await this.getLatestEpisodes(program.id, listened.podcastUrl);
		} catch (e) {
			this.logger.warn(
				`Can't retrieve the latest episodes of ${program.name}: ${e instanceof Error ? e.message : e}`,
			);
			return { origin, ...alreadySaved };
		}
		const matchedEpisode = latest.latestEpisodes.find(
			(episode) => String(episode.id) === String(listened.episodeId),
		);
		if (!matchedEpisode) {
			return { origin, ...alreadySaved };
		}
		const proposalDate =
			localDatetime.hour < 4 ? localDatetime.toPlainDate().subtract({ days: 1 }) : localDatetime.toPlainDate();

		let durationInMinutes = matchedEpisode.durationInMinutes;
		if (!durationInMinutes && listened.duration) {
			durationInMinutes = Math.round(Number(listened.duration) / 60 / 1000);
		}

		return {
			origin,
			...alreadySaved,
			proposition: {
				programId: program.id,
				...(programWithCover.profile ? { programProfile: programWithCover.profile } : {}),
				name: matchedEpisode.title,
				duration: durationInMinutes,
				...(listened.percentListened <= 95
					? {
							durationReal: Math.round(durationInMinutes * (listened.percentListened / 100)),
						}
					: {}),
				date: proposalDate.toString(),
				type: "podcast",
				link: matchedEpisode.link,
				externalId: String(matchedEpisode.id),
				created: localDatetime.toString(),
			},
		};
	}
}
