import type {
	DeleteParamsRequest,
	EpisodeListQuerystringRequestSchema,
	ExtractQuerystringRequest,
	LatestEpisodesResponse,
	LatestGenericQuerystringRequest,
	ProgramListQuerystringRequestSchema,
	RefIdsEnum,
	SaveBodyRequestType,
	StatsRecordResponse,
	StatsRequestSchema,
	SyncDeleteParamsRequest,
	SyncResponse,
} from "@personal-tracker/shared/internet";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";

import { randomUUID } from "crypto";

import type { InternetRepository } from "./internet.repository";
import type { LatestEpisodesCacheRepository } from "./latest-episodes-cache.repository";
import type { ListenedEpisode } from "./sync.entity";
import type { SyncProposalMongo, SyncRepository } from "./sync.repository";

import { getFranceTvVideoInfo, getYoutubeChannelInfo, getYoutubeVideoInfo } from "./extractor";
import { fetchLatestEpisodes, getPodcastCoverImageUrl } from "./fetch-latest";
import { ImageStorageRepository } from "./image-storage.repository";
import { buildEpisode, cleanEpisode, getDetails, sortByDuration, sortEpisodesDesc } from "./internet.entity";
import { extractListenedEpisodesFromBuffer } from "./sync.entity";

type ProgramListQuery = z.infer<typeof ProgramListQuerystringRequestSchema>;
type EpisodeListQuery = z.infer<typeof EpisodeListQuerystringRequestSchema>;
type StatsQuery = z.infer<typeof StatsRequestSchema>;

export class ListProgramsUseCase {
	constructor(private repo: InternetRepository) {}

	execute({ sort, search }: ProgramListQuery, log: FastifyBaseLogger) {
		log.info("ListProgramsUseCase.execute");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		return this.repo.findAll({ search: search ?? "", sortField, sortDirection });
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

class SyncProposalBuilder {
	constructor(
		private repo: InternetRepository,
		private cache: LatestEpisodesCacheRepository,
		private imageStorage: ImageStorageRepository,
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

		let latest: LatestEpisodesResponse;
		try {
			latest = await this.getLatestEpisodes(program.id, listened.podcastUrl);
		} catch (e) {
			console.log(e);
			console.log("Can't retrieve latest episodes for", program.name);
			return { origin };
		}
		const matchedEpisode = latest.latestEpisodes.find(
			(episode) => String(episode.id) === String(listened.episodeId),
		);
		if (!matchedEpisode) {
			return { origin };
		}
		const proposalDate =
			localDatetime.hour < 4 ? localDatetime.toPlainDate().subtract({ days: 1 }) : localDatetime.toPlainDate();

		let durationInMinutes = matchedEpisode.durationInMinutes;
		if (!durationInMinutes && listened.duration) {
			durationInMinutes = Math.round(Number(listened.duration) / 60 / 1000);
		}

		return {
			origin,
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

export class ListSyncProposalsUseCase {
	constructor(private syncRepo: SyncRepository) {}

	async execute(log: FastifyBaseLogger) {
		log.info("ListSyncProposalsUseCase.execute");
		return ((await this.syncRepo.findAll()) ?? []) as SyncResponse;
	}
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
		if (await this.syncRepo.count()) {
			throw new Error("Une synchronisation est déjà en cours");
		}

		const listenedEpisodes = extractListenedEpisodesFromBuffer(content);
		const builder = new SyncProposalBuilder(this.repo, this.cache, this.imageStorage);

		const proposals: Array<SyncProposalMongo> = [];
		for (const listened of listenedEpisodes) {
			proposals.push({ id: randomUUID(), listened, ...(await builder.build(listened)) });
		}

		if (proposals.length) await this.syncRepo.insertMany(proposals);
		return { count: proposals.length };
	}
}

export class ReprocessSyncProposalsUseCase {
	constructor(
		private repo: InternetRepository,
		private syncRepo: SyncRepository,
		private cache: LatestEpisodesCacheRepository,
		private imageStorage: ImageStorageRepository,
	) {}

	async execute(log: FastifyBaseLogger) {
		log.info("ReprocessSyncProposalsUseCase.execute");
		const proposals = (await this.syncRepo.findAllWithSource()) ?? [];
		const builder = new SyncProposalBuilder(this.repo, this.cache, this.imageStorage, true);

		for (const { id, listened } of proposals) {
			await this.syncRepo.replace({ id, listened, ...(await builder.build(listened)) });
		}
		return { count: proposals.length };
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

export class GetStatsUseCase {
	constructor(private repo: InternetRepository) {}

	async execute({ from, to }: StatsQuery, log: FastifyBaseLogger) {
		log.info("GetStatsUseCase.execute");
		const rawData = await this.repo.findStatsRaw({ from, to });
		const results: StatsRecordResponse = rawData?.reduce(
			(acc: any, program: any) => {
				acc.summary.nbPrograms += 1;
				if (!acc.programs[program.id]) {
					acc.programs[program.id] = {
						name: program.shortName || program.name,
						duration: 0,
					};
				}
				program.episodes.forEach((ep: any) => {
					acc.summary.nbEpisodes += 1;
					const duration = ep.durationReal ?? ep.duration;
					acc.programs[program.id].duration += duration;
					acc.summary.total += duration;
					(program.tags ?? []).forEach((tag: string) => {
						if (!acc.tags[tag]) {
							acc.tags[tag] = {
								name: tag,
								duration: 0,
								details: {},
							};
						}
						acc.tags[tag].duration += duration;
						if (!acc.tags[tag].details[program.id]) {
							acc.tags[tag].details[program.id] = { name: program.name, duration: 0 };
						}
						acc.tags[tag].details[program.id].duration += duration;
					});
					(ep.tags ?? []).forEach((tag: string) => {
						if (!acc.tags[tag]) {
							acc.tags[tag] = {
								name: tag,
								duration: 0,
								details: {},
							};
						}
						acc.tags[tag].duration += duration;
						if (!acc.tags[tag].details[program.id]) {
							acc.tags[tag].details[program.id] = { name: program.name, duration: 0 };
						}
						acc.tags[tag].details[program.id].duration += duration;
					});
				});

				return acc;
			},
			{
				programs: {},
				tags: {},
				summary: {
					averageByDays: 0,
					total: 0,
					nbPrograms: 0,
					nbEpisodes: 0,
					nbDays: 0,
				},
			},
		);

		const now = Temporal.Now.plainDateISO();
		let nbDays = 0;
		let inProgress = true;

		const startPeriod = Temporal.PlainDate.from(from);
		const endPeriod = Temporal.PlainDate.from(to);
		if (Temporal.PlainDate.compare(now, startPeriod) < 0) {
			// period in future
			nbDays = 0;
			inProgress = true;
		} else if (Temporal.PlainDate.compare(endPeriod, now) < 0) {
			// period in past
			nbDays = Math.abs(startPeriod.until(endPeriod).days + 1);
			inProgress = false;
		} else {
			// current period
			nbDays = Math.abs(startPeriod.until(now).days + 1);
			inProgress = true;
		}

		return {
			summary: {
				averageByDays: Math.round(results.summary.total / nbDays),
				total: results.summary.total,
				nbPrograms: results.summary.nbPrograms,
				nbEpisodes: results.summary.nbEpisodes,
				nbDays: nbDays,
				inProgress: inProgress,
			},
			programs: Object.values(results.programs).sort(sortByDuration),
			tags: Object.values(results.tags)
				.map((tag) => {
					return { ...tag, details: Object.values(tag.details).sort(sortByDuration) };
				})
				.sort(sortByDuration),
		};
	}
}

export class GetFortnightStatsUseCase {
	constructor(private repo: InternetRepository) {}

	async execute(log: FastifyBaseLogger) {
		log.info("GetFortnightStatsUseCase.execute");
		const today = Temporal.Now.plainDateISO();
		const from = today.subtract({ days: 13 });
		const to = today;

		// Data queries
		const data = await this.repo.findEpisodesInRange({ from: from.toString(), to: to.toString() });

		const dayDistribution: Record<string, number> = {};
		for (let date = from; Temporal.PlainDate.compare(date, to) <= 0; date = date.add({ days: 1 })) {
			dayDistribution[date.toString()] = 0;
		}

		for (let program of data ?? []) {
			for (let episode of program.episodes) {
				if (typeof dayDistribution[episode.date] === "undefined") {
					console.error("Ignoring", episode.date, "period", from.toString(), to.toString());
					continue;
				}
				dayDistribution[episode.date] += episode.durationReal ?? episode.duration;
			}
		}

		return Object.entries(dayDistribution)
			.map(([date, duration]) => ({ date, duration }))
			.toSorted((a, b) => a.date.localeCompare(b.date));
	}
}
