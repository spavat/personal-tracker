import type {
	EpisodeListQuerystringRequestSchema,
	ExtractQuerystringRequest,
	ProgramListQuerystringRequestSchema,
	SaveBodyRequestType,
} from "@personal-tracker/shared/internet";
import type { z } from "zod";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { NotFoundError } from "../common/errors.js";
import { getPodcastCoverImageUrl } from "./episode-feed.client.js";
import { InternetImagesStorage, type InternetImageKind } from "./internet-images.storage.js";
import { buildEpisode, cleanEpisode, getDetails, type ProgramMongo, sortEpisodesDesc } from "./internet.entity.js";
import { InternetRepository } from "./internet.repository.js";
import { getFranceTvVideoInfo, getYoutubeChannelInfo, getYoutubeVideoInfo } from "./video-info.client.js";

export type ProgramListQuery = z.infer<typeof ProgramListQuerystringRequestSchema>;
export type EpisodeListQuery = z.infer<typeof EpisodeListQuerystringRequestSchema>;

type Images = { profile?: string; banner?: string };
type SyncResult = { id: string; name: string };
type SyncError = SyncResult & { error: string };

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Programs (podcasts, channels, shows) and their episodes. Also used by the podcast sync to save a validated proposal.
@Injectable()
export class InternetService {
	private readonly logger = new Logger(InternetService.name);
	constructor(
		private readonly repo: InternetRepository,
		private readonly images: InternetImagesStorage,
	) {}

	async listPrograms({ sort, search }: ProgramListQuery) {
		this.logger.log("listPrograms");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		const programs = await this.repo.findAll({ search: search ?? "", sortField, sortDirection });
		return programs.map((program) => this.images.resolveImages(program));
	}

	async listEpisodes({ from, to }: EpisodeListQuery) {
		this.logger.log("listEpisodes");
		const programs = await this.repo.findEpisodesInRange({ from, to });
		return programs.map((program) => this.images.resolveImages(program));
	}

	async getProgram(programId: string) {
		this.logger.log("getProgram");
		const program = (await this.repo.findById(programId)) ?? notFound();
		const { _id, episodes, ...rest } = program;
		const result = { ...this.images.resolveImages(rest), episodes: episodes?.toSorted(sortEpisodesDesc) ?? [] };
		return { ...result, details: getDetails(result) };
	}

	// What can be read from a YouTube video / channel or a france.tv page; {} when nothing can
	async extract({ url }: ExtractQuerystringRequest) {
		this.logger.log("extract");
		if (!url) return {};

		try {
			if (url.includes("youtube.com/watch")) {
				const video = await getYoutubeVideoInfo(url);
				const suggestedPrograms = await this.repo.findChannelsByYoutubeChannelId(video.author.channelId);
				return { ...video, type: "video", suggestedPrograms };
			} else if (url.includes("youtube.com")) {
				return await getYoutubeChannelInfo(url);
			} else if (url.includes("france.tv/")) {
				const video = await getFranceTvVideoInfo(url);
				const suggestedPrograms = await this.repo.findChannelsByUrl(video.author.url);
				return { ...video, type: "video", suggestedPrograms };
			}
		} catch (e) {
			this.logger.error(`Can't extract information from ${url}: ${errorMessage(e)}`);
		}
		return {};
	}

	// A program with neither image, or a profile given as an outside URL / data URI, gets its images stored in S3
	async save({ program, episode, programId }: SaveBodyRequestType) {
		this.logger.log("save");
		const episodeData = episode ? cleanEpisode(episode) : null;

		if (program) {
			const id = program.id ?? randomUUID();
			const { profile, banner, ...programRest } = program;
			const current = program.id ? await this.repo.findById(program.id) : null;
			let images = await this.uploadGivenImages(id, current, { profile, banner });

			if (!program.id && !images.profile && !images.banner) {
				images = await this.fetchImagesFromRefs(id, program.refs);
			}

			if (program.id) {
				return this.repo.updateProgram(program.id, { ...programRest, ...images });
			}
			return this.repo.insertProgram({
				...programRest,
				...images,
				id,
				episodes: episodeData ? [buildEpisode(episodeData)] : [],
			});
		}

		// The body schema's refine guarantees an episode with its programId here
		if (episodeData?.id) {
			return this.repo.updateEpisode(programId!, episodeData);
		}
		return this.repo.pushEpisode(programId!, buildEpisode(episodeData));
	}

	deleteEpisode(programId: string, episodeId: string) {
		this.logger.log("deleteEpisode");
		return this.repo.deleteEpisode(programId, episodeId);
	}

	// Fetches the missing profile / banner of the YouTube channels and RSS podcasts
	async syncCovers() {
		this.logger.log("syncCovers");
		const successes: Array<SyncResult> = [];
		const errors: Array<SyncError> = [];

		for (const program of await this.repo.findProgramsWithYoutubeChannel()) {
			const channelId = program.refs?.youtubeChannelId;
			if (!channelId) continue;
			try {
				const channel = await getYoutubeChannelInfo(`https://youtube.com/channel/${channelId}`);
				const images = await this.uploadMissingImages(program, {
					profile: channel.profile?.url,
					banner: channel.banner?.url,
				});
				if (images.profile || images.banner) {
					await this.repo.updateProgram(program.id, images);
				}
				successes.push({ id: program.id, name: program.name });
			} catch (e) {
				this.logger.error(`Can't sync the YouTube images of ${program.id}: ${errorMessage(e)}`);
				errors.push({ id: program.id, name: program.name, error: errorMessage(e) });
			}
		}

		for (const program of await this.repo.findProgramsWithRssFeed()) {
			const rssUrl = program.refs?.rss;
			if (!rssUrl) continue;
			try {
				const images = await this.uploadMissingImages(program, {
					profile: await getPodcastCoverImageUrl(rssUrl),
				});
				if (images.profile) {
					await this.repo.updateProgram(program.id, images);
				}
				successes.push({ id: program.id, name: program.name });
			} catch (e) {
				this.logger.error(`Can't sync the RSS cover of ${program.id}: ${errorMessage(e)}`);
				errors.push({ id: program.id, name: program.name, error: errorMessage(e) });
			}
		}

		return { successes, errors };
	}

	private async upload(programId: string, sources: Images, keep: (kind: InternetImageKind) => boolean) {
		const images: Images = {};
		for (const kind of ["profile", "banner"] as const) {
			const source = sources[kind];
			if (source && keep(kind)) {
				images[kind] = await this.images.uploadFromSource(programId, source, kind);
			}
		}
		return images;
	}

	// Only the images the program does not have yet
	private uploadMissingImages(program: ProgramMongo, sources: Images) {
		return this.upload(program.id, sources, (kind) => !program[kind]);
	}

	// An image already served by us (/images/internet/...) keeps its stored key
	private async uploadGivenImages(programId: string, current: ProgramMongo | null, sources: Images) {
		const images = await this.upload(programId, sources, (kind) => !this.images.isOwnUrl(sources[kind]!));
		for (const kind of ["profile", "banner"] as const) {
			if (sources[kind] && this.images.isOwnUrl(sources[kind]) && current?.[kind]) {
				images[kind] = current[kind];
			}
		}
		return images;
	}

	// A new program without images: from its YouTube channel, otherwise its podcast feed
	private async fetchImagesFromRefs(programId: string, refs?: ProgramMongo["refs"]): Promise<Images> {
		try {
			if (refs?.youtubeChannelId) {
				const channel = await getYoutubeChannelInfo(`https://youtube.com/channel/${refs.youtubeChannelId}`);
				return await this.upload(
					programId,
					{ profile: channel.profile?.url, banner: channel.banner?.url },
					() => true,
				);
			}
			if (refs?.rss) {
				return await this.upload(programId, { profile: await getPodcastCoverImageUrl(refs.rss) }, () => true);
			}
		} catch (e) {
			this.logger.warn(`Can't fetch the images of the new program ${programId}: ${errorMessage(e)}`);
		}
		return {};
	}
}

function notFound(): never {
	throw new NotFoundError("Programme introuvable");
}
