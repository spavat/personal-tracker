import type {
	SaveBodyRequestType,
	SyncCreateResponse,
	SyncDeleteParamsRequest,
	SyncFeedBodyRequest,
	SyncGopodderStatusResponse,
	SyncLinkFeedBodyRequest,
	SyncResponse,
	SyncUnknownFeedsResponse,
} from "@personal-tracker/shared/internet";
import type { FastifyBaseLogger } from "fastify";

import { randomUUID } from "crypto";

import type { ImageStorageRepository } from "../image-storage.repository";
import type { InternetRepository } from "../internet.repository";
import type { SaveProgramUseCase } from "../internet.useCases";
import type { LatestEpisodesCacheRepository } from "../latest-episodes-cache.repository";
import type { SyncStateRepository } from "./sync-state.repository";
import type { ListenedEpisode } from "./sync.entity";
import type { SyncProposalMongo, SyncRepository } from "./sync.repository";

import { fetchLatestEpisodes, fetchPodcastTitle } from "../fetch-latest";
import { fetchEpisodeActions } from "./gopodder";
import { SyncProposalBuilder } from "./sync-proposal.builder";
import { aggregateEpisodeActions, extractListenedEpisodesFromBuffer } from "./sync.entity";

export class ListSyncProposalsUseCase {
	constructor(private syncRepo: SyncRepository) {}

	async execute(log: FastifyBaseLogger) {
		log.info("ListSyncProposalsUseCase.execute");
		return ((await this.syncRepo.findAll()) ?? []) as SyncResponse;
	}
}

async function assertNoSyncInProgress(syncRepo: SyncRepository) {
	if (await syncRepo.count()) {
		throw new Error("Une synchronisation est déjà en cours");
	}
}

// Shared by every source (AntennaPod backup, gopodder): one proposal per listened episode
async function createSyncProposals(
	listenedEpisodes: Array<ListenedEpisode>,
	builder: SyncProposalBuilder,
	syncRepo: SyncRepository,
) {
	const proposals: Array<SyncProposalMongo> = [];
	for (const listened of listenedEpisodes) {
		proposals.push({ id: randomUUID(), listened, ...(await builder.build(listened)) });
	}

	if (proposals.length) await syncRepo.insertMany(proposals);
	return { count: proposals.length };
}

export class UploadAntennaPodUseCase {
	constructor(
		private repo: InternetRepository,
		private syncRepo: SyncRepository,
		private cache: LatestEpisodesCacheRepository,
		private imageStorage: ImageStorageRepository,
	) {}

	async execute(content: Uint8Array, log: FastifyBaseLogger) {
		log.info("UploadAntennaPodUseCase.execute");
		await assertNoSyncInProgress(this.syncRepo);

		const listenedEpisodes = extractListenedEpisodesFromBuffer(content);
		const builder = new SyncProposalBuilder(this.repo, this.cache, this.imageStorage);
		return createSyncProposals(listenedEpisodes, builder, this.syncRepo);
	}
}

export class SyncGopodderUseCase {
	constructor(
		private repo: InternetRepository,
		private syncRepo: SyncRepository,
		private syncStateRepo: SyncStateRepository,
		private cache: LatestEpisodesCacheRepository,
		private imageStorage: ImageStorageRepository,
	) {}

	async execute(log: FastifyBaseLogger): Promise<SyncCreateResponse> {
		log.info("SyncGopodderUseCase.execute");
		await assertNoSyncInProgress(this.syncRepo);

		const since = await this.syncStateRepo.getGopodderSince();
		if (since === undefined) {
			// AntennaPod's first sync uploads the whole history stamped with the sync time:
			// only record the starting point, older history comes from the backup import
			const { timestamp } = await fetchEpisodeActions(Math.floor(Date.now() / 1000));
			await this.syncStateRepo.setGopodderSince(timestamp);
			return { count: 0, initialized: true };
		}

		const { actions, timestamp } = await fetchEpisodeActions(since);
		const listenedEpisodes = aggregateEpisodeActions(actions);
		await fillTitlesFromFeeds(listenedEpisodes);

		const builder = new SyncProposalBuilder(this.repo, this.cache, this.imageStorage);
		const result = await createSyncProposals(listenedEpisodes, builder, this.syncRepo);
		await this.syncStateRepo.setGopodderSince(timestamp);
		return result;
	}
}

export class GetGopodderStatusUseCase {
	constructor(private syncStateRepo: SyncStateRepository) {}

	async execute(log: FastifyBaseLogger): Promise<SyncGopodderStatusResponse> {
		log.info("GetGopodderStatusUseCase.execute");
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

export class ReprocessSyncProposalsUseCase {
	constructor(
		private repo: InternetRepository,
		private syncRepo: SyncRepository,
		private cache: LatestEpisodesCacheRepository,
		private imageStorage: ImageStorageRepository,
	) {}

	// With rssUrl: only the proposals of that feed (after it has been linked to a program)
	async execute(rssUrl: string | undefined, log: FastifyBaseLogger) {
		log.info("ReprocessSyncProposalsUseCase.execute");
		const proposals =
			(await (rssUrl ? this.syncRepo.findByPodcastUrl(rssUrl) : this.syncRepo.findAllWithSource())) ?? [];
		const builder = new SyncProposalBuilder(this.repo, this.cache, this.imageStorage, true);

		for (const { id, listened } of proposals) {
			await this.syncRepo.replace({ id, listened, ...(await builder.build(listened)) });
		}
		return { count: proposals.length };
	}
}

export class ListUnknownFeedsUseCase {
	constructor(
		private repo: InternetRepository,
		private syncRepo: SyncRepository,
	) {}

	async execute(log: FastifyBaseLogger): Promise<SyncUnknownFeedsResponse> {
		log.info("ListUnknownFeedsUseCase.execute");
		const feeds = new Map<string, { rssUrl: string; title: string; count: number }>();
		for (const { listened } of (await this.syncRepo.findWithoutProposition()) ?? []) {
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
		return unknown.sort((a, b) => a.title.localeCompare(b.title));
	}
}

export class LinkFeedToProgramUseCase {
	constructor(
		private repo: InternetRepository,
		private reprocess: ReprocessSyncProposalsUseCase,
	) {}

	async execute({ rssUrl, programId }: SyncLinkFeedBodyRequest, log: FastifyBaseLogger) {
		log.info("LinkFeedToProgramUseCase.execute");
		if (!(await this.repo.findById(programId))) {
			throw new Error("Programme introuvable");
		}
		// The feed URL known by AntennaPod replaces the program's one, so the next syncs match directly
		await this.repo.setRssRef(programId, rssUrl);
		return this.reprocess.execute(rssUrl, log);
	}
}

export class IgnoreFeedUseCase {
	constructor(private syncRepo: SyncRepository) {}

	async execute({ rssUrl }: SyncFeedBodyRequest, log: FastifyBaseLogger) {
		log.info("IgnoreFeedUseCase.execute");
		const result = await this.syncRepo.deleteByPodcastUrl(rssUrl);
		return { count: result?.deletedCount ?? 0 };
	}
}

export class ValidateSyncProposalUseCase {
	constructor(
		private syncRepo: SyncRepository,
		private saveProgram: SaveProgramUseCase,
	) {}

	async execute({ id, body }: { id: string; body: SaveBodyRequestType }, log: FastifyBaseLogger) {
		log.info("ValidateSyncProposalUseCase.execute");
		const result = await this.saveProgram.execute(body, log);
		await this.syncRepo.delete(id);
		return result;
	}
}

export class DeleteSyncProposalUseCase {
	constructor(private syncRepo: SyncRepository) {}

	execute({ id }: SyncDeleteParamsRequest, log: FastifyBaseLogger) {
		log.info("DeleteSyncProposalUseCase.execute");
		return this.syncRepo.delete(id);
	}
}
