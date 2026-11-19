import type {
	LatestEpisodesResponse,
	LatestGenericQuerystringRequest,
	RefIdsEnum,
} from "@personal-tracker/shared/internet";

import { Injectable, Logger } from "@nestjs/common";

import { BadRequestError, UpstreamError } from "../../common/errors.js";
import { fetchLatestEpisodes } from "../episode-feed.client.js";
import { InternetRepository } from "../internet.repository.js";
import { LatestEpisodesCache } from "../latest-episodes.cache.js";

const CACHE_HOURS = 2;
// The program ref read for each source, in order of preference when none is forced
const REF_TYPES: RefIdsEnum[] = ["rss", "youtubePlaylistId", "youtubeChannelId"];

const now = () => Temporal.Now.plainDateTimeISO().toString({ fractionalSecondDigits: 0 });

@Injectable()
export class LatestService {
	private readonly logger = new Logger(LatestService.name);
	constructor(
		private readonly repo: InternetRepository,
		private readonly cache: LatestEpisodesCache,
	) {}

	// The latest episodes of any feed (a program being created)
	async latest({ url, type }: LatestGenericQuerystringRequest): Promise<LatestEpisodesResponse> {
		this.logger.log("latest");
		if (!url || !type) throw new BadRequestError("internet.no_feed", "no feed to read");
		return { dateTimeUtc: now(), type, latestEpisodes: await this.fetch(url, type) };
	}

	// The latest episodes of a program's feed, cached 2 hours unless a source is forced; `view` flags those already saved
	async latestForProgram(programId: string, force: RefIdsEnum | undefined): Promise<LatestEpisodesResponse> {
		this.logger.log("latestForProgram");
		if (!force) {
			const cached = this.cache.get(programId);
			if (cached && this.hoursSince(cached.dateTimeUtc) < CACHE_HOURS) {
				return cached;
			}
		}

		const program = await this.repo.findById(programId);
		const type = force ?? REF_TYPES.find((refType) => program?.refs?.[refType]);
		const url = type ? program?.refs?.[type] : undefined;
		if (!type || !url) throw new BadRequestError("internet.no_feed", "no feed to read");

		const savedExternalIds = new Set(
			(program?.episodes ?? []).flatMap((episode) => (episode.externalId ? [episode.externalId] : [])),
		);
		const latestEpisodes = (await this.fetch(url, type)).map((episode) => ({
			...episode,
			view: Boolean(episode.id && savedExternalIds.has(episode.id)),
		}));
		const response = { dateTimeUtc: now(), type, latestEpisodes };

		if (latestEpisodes.length) this.cache.set(programId, response);
		return response;
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
