import type {
	DeleteParamsRequest,
	EpisodeListQuerystringRequestSchema,
	ExtractQuerystringRequest,
	ProgramListQuerystringRequestSchema,
	SaveBodyRequestType,
} from "@personal-tracker/shared/internet";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";

import { randomUUID } from "crypto";

import type { InternetRepository } from "./internet.repository";

import { getFranceTvVideoInfo, getYoutubeChannelInfo, getYoutubeVideoInfo } from "./extractor";
import { getPodcastCoverImageUrl } from "./fetch-latest";
import { ImageStorageRepository } from "./image-storage.repository";
import { buildEpisode, cleanEpisode, getDetails, sortEpisodesDesc } from "./internet.entity";

type ProgramListQuery = z.infer<typeof ProgramListQuerystringRequestSchema>;
type EpisodeListQuery = z.infer<typeof EpisodeListQuerystringRequestSchema>;

export class ListProgramsUseCase {
	constructor(
		private repo: InternetRepository,
		private imageStorage: ImageStorageRepository,
	) {}

	async execute({ sort, search }: ProgramListQuery, log: FastifyBaseLogger) {
		log.info("ListProgramsUseCase.execute");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		const programs = await this.repo.findAll({ search: search ?? "", sortField, sortDirection });
		return (programs ?? []).map((program: any) => this.imageStorage.resolveImages(program));
	}
}

export class ListEpisodesUseCase {
	constructor(
		private repo: InternetRepository,
		private imageStorage: ImageStorageRepository,
	) {}

	async execute({ from, to }: EpisodeListQuery, log: FastifyBaseLogger) {
		log.info("ListEpisodesUseCase.execute");
		const programs = await this.repo.findEpisodesInRange({ from, to });
		return (programs ?? []).map((program: any) => this.imageStorage.resolveImages(program));
	}
}

export class ExtractInfoUseCase {
	constructor(private repo: InternetRepository) {}

	async execute({ url }: ExtractQuerystringRequest, log: FastifyBaseLogger) {
		log.info("ExtractInfoUseCase.execute");
		if (!url) {
			return {};
		}

		try {
			if (url.includes("youtube.com/watch")) {
				const ytVideoInfos = await getYoutubeVideoInfo(url);
				const suggestedPrograms = await this.repo.findChannelsByYoutubeChannelId(ytVideoInfos.author.channelId);
				return { ...ytVideoInfos, type: "video", suggestedPrograms };
			} else if (url.includes("youtube.com")) {
				const ytChannelInfos = await getYoutubeChannelInfo(url);
				return ytChannelInfos;
			} else if (url.includes("france.tv/")) {
				const infos = await getFranceTvVideoInfo(url);
				const suggestedPrograms = await this.repo.findChannelsByUrl(infos.author.url);
				return { ...infos, type: "video", suggestedPrograms };
			}
		} catch (err) {
			log.error({ err, url }, "Can't extract information");
			return {};
		}

		return {};
	}
}

type SyncResult = { id: string; name: string };
type SyncError = SyncResult & { error: string };

export class SyncCoversUseCase {
	constructor(
		private repo: InternetRepository,
		private imageStorage: ImageStorageRepository,
	) {}

	private async uploadMissingImages(
		program: { id: string; profile?: string; banner?: string },
		sources: { profile?: string; banner?: string },
	) {
		const images: { profile?: string; banner?: string } = {};
		if (!program.profile && sources.profile) {
			images.profile = await this.imageStorage.uploadFromSource(
				`personal-tracker/internet/${program.id}.profile`,
				sources.profile,
				"profile",
			);
		}
		if (!program.banner && sources.banner) {
			images.banner = await this.imageStorage.uploadFromSource(
				`personal-tracker/internet/${program.id}.banner`,
				sources.banner,
				"banner",
			);
		}
		return images;
	}

	private async syncYoutubeChannels(successes: Array<SyncResult>, errors: Array<SyncError>, log: FastifyBaseLogger) {
		const programs = (await this.repo.findProgramsWithYoutubeChannel()) ?? [];

		for (const program of programs) {
			const channelId = program.refs?.youtubeChannelId;
			if (!channelId) continue;

			try {
				const ytInfos = await getYoutubeChannelInfo(`https://youtube.com/channel/${channelId}`);
				const images = await this.uploadMissingImages(program, {
					profile: ytInfos.profile?.url,
					banner: ytInfos.banner?.url,
				});

				if (images.profile || images.banner) {
					await this.repo.updateProgram(program.id, images);
				}

				successes.push({ id: program.id, name: program.name });
			} catch (e) {
				log.error({ err: e, programId: program.id }, "Can't sync Youtube images for");
				errors.push({ id: program.id, name: program.name, error: e instanceof Error ? e.message : String(e) });
			}
		}
	}

	private async syncRssFeeds(successes: Array<SyncResult>, errors: Array<SyncError>, log: FastifyBaseLogger) {
		const programs = (await this.repo.findProgramsWithRssFeed()) ?? [];

		for (const program of programs) {
			const rssUrl = program.refs?.rss;
			if (!rssUrl) continue;

			try {
				const profileUrl = await getPodcastCoverImageUrl(rssUrl);
				const images = await this.uploadMissingImages(program, { profile: profileUrl });

				if (images.profile) {
					await this.repo.updateProgram(program.id, images);
				}

				successes.push({ id: program.id, name: program.name });
			} catch (e) {
				log.error({ err: e, programId: program.id }, "Can't sync RSS cover for");
				errors.push({ id: program.id, name: program.name, error: e instanceof Error ? e.message : String(e) });
			}
		}
	}

	async execute(log: FastifyBaseLogger) {
		log.info("SyncCoversUseCase.execute");
		const successes: Array<SyncResult> = [];
		const errors: Array<SyncError> = [];

		await this.syncYoutubeChannels(successes, errors, log);
		await this.syncRssFeeds(successes, errors, log);

		return { successes, errors };
	}
}

export class SaveProgramUseCase {
	constructor(
		private repo: InternetRepository,
		private imageStorage: ImageStorageRepository,
	) {}

	private async uploadProgramImages(
		programId: string,
		current: { profile?: string; banner?: string } | undefined,
		profile?: string,
		banner?: string,
	) {
		const images: { profile?: string; banner?: string } = {};
		if (profile) {
			images.profile = this.imageStorage.isOwnUrl(profile)
				? current?.profile
				: await this.imageStorage.uploadFromSource(
						`personal-tracker/internet/${programId}.profile`,
						profile,
						"profile",
					);
		}
		if (banner) {
			images.banner = this.imageStorage.isOwnUrl(banner)
				? current?.banner
				: await this.imageStorage.uploadFromSource(
						`personal-tracker/internet/${programId}.banner`,
						banner,
						"banner",
					);
		}
		return images;
	}

	private async fetchImagesFromRefs(programId: string, refs?: { youtubeChannelId?: string; rss?: string }) {
		if (refs?.youtubeChannelId) {
			try {
				const ytInfos = await getYoutubeChannelInfo(`https://youtube.com/channel/${refs.youtubeChannelId}`);
				const images: { profile?: string; banner?: string } = {};
				if (ytInfos.profile?.url) {
					images.profile = await this.imageStorage.uploadFromSource(
						`personal-tracker/internet/${programId}.profile`,
						ytInfos.profile.url,
						"profile",
					);
				}
				if (ytInfos.banner?.url) {
					images.banner = await this.imageStorage.uploadFromSource(
						`personal-tracker/internet/${programId}.banner`,
						ytInfos.banner.url,
						"banner",
					);
				}
				return images;
			} catch (e) {
				console.log(e);
				console.log("Can't fetch Youtube images for new program", programId);
				return {};
			}
		}

		if (refs?.rss) {
			try {
				const profileUrl = await getPodcastCoverImageUrl(refs.rss);
				if (!profileUrl) return {};
				return {
					profile: await this.imageStorage.uploadFromSource(
						`personal-tracker/internet/${programId}.profile`,
						profileUrl,
						"profile",
					),
				};
			} catch (e) {
				console.log(e);
				console.log("Can't fetch RSS cover for new program", programId);
				return {};
			}
		}

		return {};
	}

	async execute({ program, episode, programId }: SaveBodyRequestType, log: FastifyBaseLogger) {
		log.info("SaveProgramUseCase.execute");
		if (programId && program?.id) {
			throw new Error("Cannot provide both programId and program.id");
		}

		const episodeData = episode ? cleanEpisode(episode) : null;

		if (program) {
			const id = program.id ?? randomUUID();
			const { profile, banner, ...programRest } = program;
			const current = program.id ? await this.repo.findById(program.id) : undefined;
			let images = await this.uploadProgramImages(id, current ?? undefined, profile, banner);

			if (!program.id && !images.profile && !images.banner) {
				images = await this.fetchImagesFromRefs(id, program.refs);
			}

			if (program.id) {
				// Update existing program
				return this.repo.updateProgram(program.id, { ...programRest, ...images });
			}
			// Add new program
			return this.repo.insertProgram({
				...programRest,
				...images,
				id,
				episodes: episodeData ? [buildEpisode(episodeData)] : [],
			});
		}

		if (episodeData && programId) {
			if (episodeData.id) {
				// Update existing episode
				return this.repo.updateEpisode(programId, episodeData);
			}
			// Add new episode to existing program
			return this.repo.pushEpisode(programId, buildEpisode(episodeData));
		}

		return { error: "Nothing to do" };
	}
}

export class DeleteEpisodeUseCase {
	constructor(private repo: InternetRepository) {}

	execute({ programId, episodeId }: DeleteParamsRequest, log: FastifyBaseLogger) {
		log.info("DeleteEpisodeUseCase.execute");
		return this.repo.deleteEpisode(programId, episodeId);
	}
}

export class GetProgramUseCase {
	constructor(
		private repo: InternetRepository,
		private imageStorage: ImageStorageRepository,
	) {}

	async execute(programId: string, log: FastifyBaseLogger) {
		log.info("GetProgramUseCase.execute");
		const res = await this.repo.findById(programId);
		if (!res) return null;
		const { _id, episodes, ...rest } = res;
		const resuts = {
			...this.imageStorage.resolveImages(rest),
			episodes: episodes?.toSorted(sortEpisodesDesc) ?? [],
		};
		const details = getDetails(resuts);
		return { ...resuts, details };
	}
}
