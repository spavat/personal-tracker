import { Logger } from "@nestjs/common";
import { type LatestEpisodesResponse, matchFormat } from "@personal-tracker/shared/broadcast";

import type { BroadcastImagesStorage } from "../broadcast-images.storage.js";
import type { EpisodeDoc } from "../broadcast.entity.js";
import type { BroadcastRepository } from "../broadcast.repository.js";
import type { LatestEpisodesCache } from "../latest-episodes.cache.js";
import type { ListenedEpisode } from "./sync.entity.js";
import type { SyncProposalMongo } from "./sync.repository.js";

import { fetchLatestEpisodes } from "../sources/episode-feed.client.js";

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

// Latest view of the saved episode with this external id (relistening): flagged on the proposal, never skipped
function findAlreadySaved(episodes: Array<EpisodeDoc>, externalId: string) {
	const date = episodes
		.filter((episode) => episode.externalId !== undefined && String(episode.externalId) === String(externalId))
		.flatMap((episode) => episode.views.map((view) => view.date))
		.sort()
		.at(-1);
	return date ? { alreadySaved: { date } } : {};
}

// Built for one sync run (not a provider): it keeps the feeds already fetched during the run
export class SyncProposalBuilder {
	private readonly logger = new Logger(SyncProposalBuilder.name);

	constructor(
		private repo: BroadcastRepository,
		private cache: LatestEpisodesCache,
		private imageStorage: BroadcastImagesStorage,
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
		const proposalDate =
			localDatetime.hour < 4 ? localDatetime.toPlainDate().subtract({ days: 1 }) : localDatetime.toPlainDate();
		const view = (duration: number) => ({
			...(listened.percentListened <= 95
				? { durationReal: Math.round(duration * (listened.percentListened / 100)) }
				: {}),
			date: proposalDate.toString(),
			created: localDatetime.toString(),
		});

		// an episode already stored (imported in a catalog, or listened before): the view goes to it, with its fields
		const stored = program.episodes.find(
			({ externalId }) => externalId !== undefined && String(externalId) === String(listened.episodeId),
		);
		if (stored) {
			const duration = stored.duration || Math.round(Number(listened.duration) / 60 / 1000);
			return {
				origin,
				...alreadySaved,
				proposition: {
					programId: program.id,
					...(programWithCover.profile ? { programProfile: programWithCover.profile } : {}),
					name: stored.name,
					...(stored.shortName ? { shortName: stored.shortName } : {}),
					duration,
					type: stored.type || "podcast",
					...(stored.releaseDate ? { releaseDate: stored.releaseDate } : {}),
					...(stored.link ? { link: stored.link } : {}),
					...(stored.description ? { description: stored.description } : {}),
					...(stored.cover ? { cover: stored.cover } : {}),
					externalId: String(listened.episodeId),
					...(stored.seasonId ? { seasonId: stored.seasonId } : {}),
					...(stored.formatId ? { formatId: stored.formatId } : {}),
					...(stored.position !== undefined ? { position: stored.position } : {}),
					...(stored.numberLabel ? { numberLabel: stored.numberLabel } : {}),
					...(stored.tags ? { tags: stored.tags } : {}),
					...(stored.ignoredTags ? { ignoredTags: stored.ignoredTags } : {}),
					...view(duration),
				},
			};
		}

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
		let durationInMinutes = matchedEpisode.durationInMinutes;
		if (!durationInMinutes && listened.duration) {
			durationInMinutes = Math.round(Number(listened.duration) / 60 / 1000);
		}

		// the format whose match rule fits the title, pre-selected
		const format = matchFormat(await this.repo.findFormats(program.id), matchedEpisode.title);

		return {
			origin,
			...alreadySaved,
			proposition: {
				programId: program.id,
				...(format ? { formatId: format.id } : {}),
				...(programWithCover.profile ? { programProfile: programWithCover.profile } : {}),
				name: matchedEpisode.title,
				duration: durationInMinutes,
				type: "podcast",
				releaseDate: matchedEpisode.date,
				link: matchedEpisode.link,
				...(matchedEpisode.description ? { description: matchedEpisode.description } : {}),
				...(matchedEpisode.cover ? { cover: matchedEpisode.cover } : {}),
				externalId: String(matchedEpisode.id),
				...view(durationInMinutes),
			},
		};
	}
}
