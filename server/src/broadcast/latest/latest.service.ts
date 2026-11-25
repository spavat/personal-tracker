import type {
	LatestEpisodesResponse,
	LatestGenericQuerystringRequest,
	RefIdsEnum,
} from "@personal-tracker/shared/broadcast";

import { Injectable, Logger } from "@nestjs/common";

import { BadRequestError, UpstreamError } from "../../common/errors.js";
import { BroadcastRepository } from "../broadcast.repository.js";
import { LatestEpisodesCache } from "../latest-episodes.cache.js";
import { fetchLatestEpisodes } from "../sources/episode-feed.client.js";

const CACHE_HOURS = 2;
// The program ref read for each source, in order of preference when none is forced
const REF_TYPES: RefIdsEnum[] = ["rss", "youtubePlaylistId", "youtubeChannelId"];

const now = () => Temporal.Now.plainDateTimeISO().toString({ fractionalSecondDigits: 0 });

@Injectable()
export class LatestService {
	private readonly logger = new Logger(LatestService.name);
	constructor(
		private readonly repo: BroadcastRepository,
		private readonly cache: LatestEpisodesCache,
	) {}

	// The latest episodes of any feed (a program being created)
	async latest({ url, type }: LatestGenericQuerystringRequest): Promise<LatestEpisodesResponse> {
		this.logger.log("latest");
		if (!url || !type) throw new BadRequestError("broadcast.no_feed", "no feed to read");
		return { dateTimeUtc: now(), type, latestEpisodes: await this.fetch(url, type) };
	}

	// The latest episodes of a program's feed, cached 2 hours unless a source is forced; each one stored is flagged
	// with `view` (it has one) and its status, read anew on each call
	async latestForProgram(programId: string, force: RefIdsEnum | undefined): Promise<LatestEpisodesResponse> {
		this.logger.log("latestForProgram");
		const program = await this.repo.findById(programId);
		let response = force ? undefined : this.cache.get(programId);
		if (!response || this.hoursSince(response.dateTimeUtc) >= CACHE_HOURS) {
			const type = force ?? REF_TYPES.find((refType) => program?.refs?.[refType]);
			const url = type ? program?.refs?.[type] : undefined;
			if (!type || !url) throw new BadRequestError("broadcast.no_feed", "no feed to read");
			response = { dateTimeUtc: now(), type, latestEpisodes: await this.fetch(url, type) };
			if (response.latestEpisodes.length) this.cache.set(programId, response);
		}

		const stored = new Map(
			(program?.episodes ?? []).flatMap((episode) => (episode.externalId ? [[episode.externalId, episode]] : [])),
		);
		return {
			...response,
			latestEpisodes: response.latestEpisodes.map(({ view: _view, status: _status, ...episode }) => {
				const saved = stored.get(episode.id);
				return {
					...episode,
					view: Boolean(saved?.views.length),
					...(saved?.status ? { status: saved.status } : {}),
				};
			}),
		};
	}

	private async fetch(url: string, type: RefIdsEnum) {
		try {
			return await fetchLatestEpisodes(url, type);
		} catch (e) {
			this.logger.error(`Can't retrieve the latest episodes of ${url}: ${e instanceof Error ? e.message : e}`);
			throw new UpstreamError("upstream_unavailable", "the feed could not be read", { service: "feed" });
		}
	}

	private hoursSince(dateTimeUtc: string) {
		const cachedAt = Temporal.PlainDateTime.from(dateTimeUtc).toZonedDateTime("UTC").toInstant();
		return Temporal.Now.instant().since(cachedAt, { largestUnit: "hours" }).total({ unit: "hours" });
	}
}
