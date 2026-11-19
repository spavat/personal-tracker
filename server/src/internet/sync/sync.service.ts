import type {
	SaveBodyRequestType,
	SyncCreateResponse,
	SyncGopodderStatusResponse,
	SyncUnknownFeedsResponse,
} from "@personal-tracker/shared/internet";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { ConflictError, NotFoundError } from "../../common/errors.js";
import { fetchLatestEpisodes, fetchPodcastTitle } from "../episode-feed.client.js";
import { InternetImagesStorage } from "../internet-images.storage.js";
import { InternetRepository } from "../internet.repository.js";
import { InternetService } from "../internet.service.js";
import { LatestEpisodesCache } from "../latest-episodes.cache.js";
import { GopodderClient } from "./gopodder.client.js";
import { SyncProposalBuilder } from "./sync-proposal.builder.js";
import { SyncStateRepository } from "./sync-state.repository.js";
import { aggregateEpisodeActions, extractListenedEpisodesFromBuffer, type ListenedEpisode } from "./sync.entity.js";
import { type SyncProposalMongo, SyncRepository } from "./sync.repository.js";

// Podcast sync: listened episodes (AntennaPod backup or gopodder) become proposals, validated one by one into episodes
@Injectable()
export class SyncService {
	private readonly logger = new Logger(SyncService.name);
	constructor(
		private readonly repo: InternetRepository,
		private readonly syncRepo: SyncRepository,
		private readonly syncStateRepo: SyncStateRepository,
		private readonly cache: LatestEpisodesCache,
		private readonly images: InternetImagesStorage,
		private readonly internet: InternetService,
		private readonly gopodder: GopodderClient,
	) {}

	list() {
		this.logger.log("list");
		return this.syncRepo.findAll();
	}

	async uploadAntennaPod(backup: Uint8Array) {
		this.logger.log("uploadAntennaPod");
		await this.assertNoSyncInProgress();
		return this.createProposals(extractListenedEpisodesFromBuffer(backup));
	}

	async syncGopodder(): Promise<SyncCreateResponse> {
		this.logger.log("syncGopodder");
		await this.assertNoSyncInProgress();

		const since = await this.syncStateRepo.getGopodderSince();
		if (since === undefined) {
			// AntennaPod's first sync uploads the whole history stamped with the sync time:
			// only record the starting point, older history comes from the backup import
			const { timestamp } = await this.gopodder.fetchEpisodeActions(Math.floor(Date.now() / 1000));
			await this.syncStateRepo.setGopodderSince(timestamp);
			return { count: 0, initialized: true };
		}

		const { actions, timestamp } = await this.gopodder.fetchEpisodeActions(since);
		const listenedEpisodes = aggregateEpisodeActions(actions);
		await fillTitlesFromFeeds(listenedEpisodes);

		const result = await this.createProposals(listenedEpisodes);
		await this.syncStateRepo.setGopodderSince(timestamp);
		return result;
	}

	async gopodderStatus(): Promise<SyncGopodderStatusResponse> {
		this.logger.log("gopodderStatus");
		// `since` is the gopodder timestamp (unix seconds) of the last fetch
		const since = await this.syncStateRepo.getGopodderSince();
		return {
			lastSync:
				since === undefined
					? null
					: Temporal.Instant.fromEpochMilliseconds(since * 1000)
							.toZonedDateTimeISO("Europe/Paris")
							.toPlainDateTime()
							.toString({ fractionalSecondDigits: 0 }),
		};
	}

	// Rebuilds the proposals, refetching the feeds. With rssUrl: only that feed's (after it was linked to a program)
	async reprocess(rssUrl?: string) {
		this.logger.log("reprocess");
		const proposals = await (rssUrl ? this.syncRepo.findByPodcastUrl(rssUrl) : this.syncRepo.findAllWithSource());
		const builder = new SyncProposalBuilder(this.repo, this.cache, this.images, true);

		for (const { id, listened } of proposals) {
			await this.syncRepo.replace({ id, listened, ...(await builder.build(listened)) });
		}
		return { count: proposals.length };
	}

	// The feeds of the proposals without a match, that no program has
	async unknownFeeds(): Promise<SyncUnknownFeedsResponse> {
		this.logger.log("unknownFeeds");
		const feeds = new Map<string, { rssUrl: string; title: string; count: number }>();
		for (const { listened } of await this.syncRepo.findWithoutProposition()) {
			const feed = feeds.get(listened.podcastUrl);
			if (feed) {
				feed.count++;
			} else {
				feeds.set(listened.podcastUrl, {
					rssUrl: listened.podcastUrl,
					title: listened.podcastTitle || listened.podcastUrl,
					count: 1,
				});
			}
		}

		const unknown: SyncUnknownFeedsResponse = [];
		for (const feed of feeds.values()) {
			if (!(await this.repo.findByRssUrl(feed.rssUrl))) unknown.push(feed);
		}
		return unknown.toSorted((a, b) => a.title.localeCompare(b.title));
	}

	async linkFeed(rssUrl: string, programId: string) {
		this.logger.log("linkFeed");
		if (!(await this.repo.findById(programId))) {
			throw new NotFoundError("Programme introuvable");
		}
		// The feed URL known by AntennaPod replaces the program's one, so the next syncs match directly
		await this.repo.setRssRef(programId, rssUrl);
		return this.reprocess(rssUrl);
	}

	async ignoreFeed(rssUrl: string) {
		this.logger.log("ignoreFeed");
		const result = await this.syncRepo.deleteByPodcastUrl(rssUrl);
		return { count: result.deletedCount };
	}

	// Saves the (possibly edited) proposal as an episode, then drops the proposal
	async validate(id: string, body: SaveBodyRequestType) {
		this.logger.log("validate");
		const result = await this.internet.save(body);
		await this.syncRepo.delete(id);
		return result;
	}

	delete(id: string) {
		this.logger.log("delete");
		return this.syncRepo.delete(id);
	}

	private async assertNoSyncInProgress() {
		if (await this.syncRepo.count()) {
			throw new ConflictError("Une synchronisation est déjà en cours");
		}
	}

	// One proposal per listened episode, whatever the source
	private async createProposals(listenedEpisodes: Array<ListenedEpisode>) {
		const builder = new SyncProposalBuilder(this.repo, this.cache, this.images);
		const proposals: Array<SyncProposalMongo> = [];
		for (const listened of listenedEpisodes) {
			proposals.push({ id: randomUUID(), listened, ...(await builder.build(listened)) });
		}
		if (proposals.length) await this.syncRepo.insertMany(proposals);
		return { count: proposals.length };
	}
}

// gopodder actions only hold URLs and guids: read the titles from each feed once
async function fillTitlesFromFeeds(listenedEpisodes: Array<ListenedEpisode>) {
	const podcastUrls = [...new Set(listenedEpisodes.map((listened) => listened.podcastUrl))];
	for (const podcastUrl of podcastUrls) {
		const podcastTitle = await fetchPodcastTitle(podcastUrl).catch(() => undefined);
		const episodes = await fetchLatestEpisodes(podcastUrl, "rss").catch(() => []);
		for (const listened of listenedEpisodes.filter((l) => l.podcastUrl === podcastUrl)) {
			listened.podcastTitle = podcastTitle ?? podcastUrl;
			listened.episodeTitle =
				episodes.find((episode) => String(episode.id) === String(listened.episodeId))?.title ?? "";
		}
	}
}
