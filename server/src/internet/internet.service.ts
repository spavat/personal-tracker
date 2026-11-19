import type {
	EpisodeListQuerystringRequestSchema,
	ExtractQuerystringRequest,
	ProgramListQuerystringRequestSchema,
	SaveBodyRequestType,
	SaveEpisodeBodyRequestType,
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

	// The program (as GET /id/:programId gives it), with an optional first episode. A program given neither image
	// gets the ones of its refs; a profile given as an outside URL / data URI is stored in S3.
	async createProgram({ program: { id: _, profile, banner, ...program }, episode }: SaveBodyRequestType) {
		this.logger.log("createProgram");
		const id = randomUUID();
		let images = await this.uploadGivenImages(id, null, { profile, banner });
		if (!images.profile && !images.banner) {
			images = await this.fetchImagesFromRefs(id, program.refs);
		}
		await this.repo.insertProgram({
			...program,
			...images,
			id,
			episodes: episode ? [buildEpisode(cleanEpisode(episode))] : [],
		});
		return this.getProgram(id);
	}

	// the program's fields only: its episodes have their own routes
	async updateProgram(id: string, { program: { id: _, profile, banner, ...program } }: SaveBodyRequestType) {
		this.logger.log("updateProgram");
		const current = (await this.repo.findById(id)) ?? notFound();
		const images = await this.uploadGivenImages(id, current, { profile, banner });
		if (!(await this.repo.updateProgram(id, { ...program, ...images }))) {
			notFound();
		}
		return this.getProgram(id);
	}

	async createEpisode(programId: string, { id: _, ...fields }: SaveEpisodeBodyRequestType) {
		this.logger.log("createEpisode");
		const episode = buildEpisode(cleanEpisode(fields));
		if (!(await this.repo.pushEpisode(programId, episode))) {
			notFound();
		}
		return episode;
	}

	async updateEpisode(programId: string, episodeId: string, { id: _, ...fields }: SaveEpisodeBodyRequestType) {
		this.logger.log("updateEpisode");
		if (!(await this.repo.updateEpisode(programId, { ...cleanEpisode(fields), id: episodeId }))) {
			episodeNotFound();
		}
		const program = await this.repo.findById(programId);
		return program?.episodes?.find((e) => e.id === episodeId) ?? episodeNotFound();
	}

	async deleteEpisode(programId: string, episodeId: string) {
		this.logger.log("deleteEpisode");
		if (!(await this.repo.deleteEpisode(programId, episodeId))) {
			episodeNotFound();
		}
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

function episodeNotFound(): never {
	throw new NotFoundError("Épisode introuvable");
}
