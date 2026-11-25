import type {
	CreateEpisodeBodyRequestType,
	EpisodeListQuerystringRequestSchema,
	EpisodeStatusBodyRequest,
	ExtractQuerystringRequest,
	ImportBodyRequest,
	ProgramListQuerystringRequestSchema,
	SaveBodyRequestType,
	SaveEpisodeBodyRequestType,
	SaveFormatsBodyRequestType,
	SaveSeasonsBodyRequestType,
	SaveViewBodyRequestType,
} from "@personal-tracker/shared/broadcast";
import type { z } from "zod";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { BadRequestError, ConflictError, NotFoundError, UpstreamError } from "../common/errors.js";
import { BroadcastImagesStorage, type BroadcastImageKind } from "./broadcast-images.storage.js";
import { getDetails, type ProgramDoc, sortEpisodesDesc, sortViewsDesc } from "./broadcast.entity.js";
import { BroadcastRepository, type CoverToImport } from "./broadcast.repository.js";
import { fetchCatalogEpisodes, getPodcastCoverImageUrl } from "./sources/episode-feed.client.js";
import { getFranceTvVideoInfo, getYoutubeChannelInfo, getYoutubeVideoInfo } from "./sources/video-info.client.js";
import { channelUploadsPlaylist, YoutubeDataClient } from "./sources/youtube-data.client.js";
import { youtubeVideoId } from "./sources/youtube-link.utils.js";

export type ProgramListQuery = z.infer<typeof ProgramListQuerystringRequestSchema>;
export type EpisodeListQuery = z.infer<typeof EpisodeListQuerystringRequestSchema>;

type Images = { profile?: string; banner?: string };
type SyncResult = { id: string; name: string };
type SyncError = SyncResult & { error: string };

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

const withoutCover = <T extends { cover?: string }>({ cover: _cover, ...fields }: T) => fields;

// Covers downloaded at the same time by an import
const COVER_DOWNLOADS = 6;

// Runs `task` on every item, `limit` at a time
async function eachLimit<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
	const queue = [...items];
	const worker = async () => {
		for (let item = queue.shift(); item !== undefined; item = queue.shift()) await task(item);
	};
	await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}

@Injectable()
export class BroadcastService {
	private readonly logger = new Logger(BroadcastService.name);
	constructor(
		private readonly repo: BroadcastRepository,
		private readonly images: BroadcastImagesStorage,
		private readonly youtube: YoutubeDataClient,
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
		const program = (await this.repo.findById(programId)) ?? programNotFound();
		const { episodes, ...rest } = program;
		// the episode watched last first, its views too
		const sorted = episodes
			.map((episode) => ({ ...episode, views: episode.views.toSorted(sortViewsDesc) }))
			.toSorted(sortEpisodesDesc);
		const [seasons, formats] = await Promise.all([
			this.repo.findSeasons(programId),
			this.repo.findFormats(programId),
		]);
		const result = { ...this.images.resolveImages(rest), episodes: sorted, seasons, formats };
		return { ...result, details: getDetails(result) };
	}

	// The whole ordered list of the program's seasons
	async saveSeasons(programId: string, { seasons }: SaveSeasonsBodyRequestType) {
		this.logger.log("saveSeasons");
		if (!(await this.repo.findById(programId))) programNotFound();
		await this.assertOwnIds(programId, seasons, "season");
		return this.repo.replaceSeasons(programId, seasons);
	}

	// The whole ordered list of the program's formats; a label is used once
	async saveFormats(programId: string, { formats }: SaveFormatsBodyRequestType) {
		this.logger.log("saveFormats");
		if (!(await this.repo.findById(programId))) programNotFound();
		await this.assertOwnIds(programId, formats, "format");
		if (new Set(formats.map(({ label }) => label.toLowerCase())).size !== formats.length) {
			throw new BadRequestError("duplicate_items", "a format label is twice", { resource: "format" });
		}
		return this.repo.replaceFormats(programId, formats);
	}

	// Every release of one of the program's sources (its RSS feed, the uploads of its YouTube channel without the
	// shorts, its YouTube playlist without the shorts), stored (upsert by externalId) in a catalog; a feed only gets
	// its stored episodes completed (from YouTube: its episodes with a YouTube link, whatever their channel)
	async importCatalog(programId: string, { source }: ImportBodyRequest) {
		this.logger.log("importCatalog");
		const program = (await this.repo.findById(programId)) ?? programNotFound();
		const ref = program.refs?.[source];
		if (!ref) throw new BadRequestError("broadcast.no_feed", "no such source to import");
		let items;
		if (source === "rss") {
			try {
				items = await fetchCatalogEpisodes(ref);
			} catch (e) {
				this.logger.error(`Can't read the catalog of ${ref}: ${errorMessage(e)}`);
				throw new UpstreamError("upstream_unavailable", "the feed could not be read", { service: "catalog" });
			}
		} else if (program.tracking === "feed") {
			// only its stored videos, asked by id: a big channel isn't read in full for a few videos
			const ids = new Set(program.episodes.flatMap(({ link }) => (link ? (youtubeVideoId(link) ?? []) : [])));
			items = await this.youtube.fetchVideos([...ids]);
		} else {
			const channel = source === "youtubeChannelId";
			items = await this.youtube.fetchPlaylistVideos(channel ? channelUploadsPlaylist(ref) : ref, {
				// the channel's playlist has none
				skipShorts: !channel,
			});
		}
		const formats = await this.repo.findFormats(programId);
		const type = source === "rss" ? "podcast" : "video";
		const { covers, ...counts } =
			(await this.repo.importEpisodes(programId, items, type, formats)) ?? programNotFound();
		await this.importCovers(covers);
		return counts;
	}

	// An image shared by several episodes is downloaded once; one that can't be read is skipped (the next import
	// tries again)
	private async importCovers(covers: CoverToImport[]) {
		const bySource = Map.groupBy(covers, ({ source }) => source);
		const saved: Array<{ episodeId: string; coverKey: string }> = [];
		await eachLimit([...bySource.entries()], COVER_DOWNLOADS, async ([source, episodes]) => {
			try {
				const image = await this.images.readEpisodeCover(source);
				for (const { episodeId } of episodes) {
					saved.push({ episodeId, coverKey: await this.images.storeEpisodeCover(image) });
				}
			} catch (e) {
				this.logger.warn(`Can't import the cover ${source}: ${errorMessage(e)}`);
			}
		});
		await this.repo.setEpisodeCovers(saved);
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
	async createProgram({ program: { profile, banner, credits, ...program }, episode }: SaveBodyRequestType) {
		this.logger.log("createProgram");
		await this.assertEntities([...(credits ?? []), ...(episode?.credits ?? [])]);
		const id = randomUUID();
		let images = await this.uploadGivenImages(id, null, { profile, banner });
		if (!images.profile && !images.banner) {
			images = await this.fetchImagesFromRefs(id, program.refs);
		}
		const coverKey = await this.newCoverKey(episode?.cover);
		const firstEpisode = episode && {
			...withoutCover(episode),
			view: episode.view ?? ("planned" as const),
			...(coverKey ? { coverKey } : {}),
		};
		try {
			await this.repo.insertProgram({ ...program, ...images, id }, credits, firstEpisode);
		} catch (e) {
			await this.dropCovers([coverKey]);
			throw e;
		}
		return this.getProgram(id);
	}

	// the program's fields only: its episodes have their own routes
	async updateProgram(id: string, { program: { profile, banner, credits, ...program } }: SaveBodyRequestType) {
		this.logger.log("updateProgram");
		await this.assertEntities(credits ?? []);
		const current = (await this.repo.findById(id)) ?? programNotFound();
		const images = await this.uploadGivenImages(id, current, { profile, banner });
		const removedCovers =
			(await this.repo.updateProgram(id, { ...program, ...images }, credits)) ?? programNotFound();
		await this.dropCovers(removedCovers);
		return this.getProgram(id);
	}

	// The episode with its first view, or planned; an episode of the program with the same externalId gets the view or
	// the status (and keeps its cover unless a new one is given)
	async createEpisode(programId: string, { view, status: _status, cover, ...fields }: CreateEpisodeBodyRequestType) {
		this.logger.log("createEpisode");
		await this.assertEntities(fields.credits);
		await this.assertGroups(programId, fields);
		const coverKey = await this.newCoverKey(cover);
		let created;
		try {
			created = await this.repo.createEpisode(
				programId,
				{ ...fields, ...(coverKey ? { coverKey } : {}) },
				// the body has one or the other
				view ?? "planned",
			);
		} catch (e) {
			await this.dropCovers([coverKey]);
			throw e;
		}
		if (!created) {
			await this.dropCovers([coverKey]);
			programNotFound();
		}
		await this.dropCovers([created.replacedCoverKey]);
		return this.findEpisode(programId, created.episodeId);
	}

	// The proxy URL of its cover keeps it, another source replaces it, none removes it
	async updateEpisode(programId: string, episodeId: string, { cover, ...fields }: SaveEpisodeBodyRequestType) {
		this.logger.log("updateEpisode");
		await this.assertEntities(fields.credits);
		await this.assertGroups(programId, fields);
		// an externalId names one episode of the program
		if (fields.externalId && (await this.repo.findEpisodeIdByExternalId(programId, fields.externalId, episodeId))) {
			throw new ConflictError("external_id_taken", "the externalId is another episode's", {
				source: "feed",
				externalId: fields.externalId,
			});
		}
		const current = (await this.repo.findEpisodeCover(episodeId, programId)) ?? episodeNotFound();
		const coverKey =
			cover && this.images.isOwnEpisodeCoverUrl(cover)
				? current.coverKey
				: ((await this.newCoverKey(cover)) ?? null);
		const isNew = coverKey !== current.coverKey;
		let saved;
		try {
			saved = await this.repo.updateEpisode(programId, episodeId, { ...fields, coverKey });
		} catch (e) {
			if (isNew) await this.dropCovers([coverKey]);
			throw e;
		}
		if (!saved) {
			if (isNew) await this.dropCovers([coverKey]);
			episodeNotFound();
		}
		if (isNew) await this.dropCovers([current.coverKey]);
		return this.findEpisode(programId, episodeId);
	}

	async deleteEpisode(programId: string, episodeId: string) {
		this.logger.log("deleteEpisode");
		const coverKey = await this.repo.deleteEpisode(programId, episodeId);
		if (coverKey === undefined) {
			episodeNotFound();
		}
		await this.dropCovers([coverKey]);
	}

	async createView(programId: string, episodeId: string, fields: SaveViewBodyRequestType) {
		this.logger.log("createView");
		const viewId = (await this.repo.createView(programId, episodeId, fields)) ?? episodeNotFound();
		return this.findView(programId, episodeId, viewId);
	}

	async updateView(programId: string, episodeId: string, viewId: string, fields: SaveViewBodyRequestType) {
		this.logger.log("updateView");
		if (!(await this.repo.updateView(programId, episodeId, viewId, fields))) {
			viewNotFound();
		}
		return this.findView(programId, episodeId, viewId);
	}

	// null clears it: a feed deletes the episode left without any view (and its cover)
	async setEpisodeStatus(programId: string, episodeId: string, { status }: EpisodeStatusBodyRequest) {
		this.logger.log("setEpisodeStatus");
		const removedCovers = (await this.repo.setEpisodeStatus(programId, episodeId, status)) ?? episodeNotFound();
		await this.dropCovers(removedCovers);
	}

	// the episode goes too when it was its last view
	async deleteView(programId: string, episodeId: string, viewId: string) {
		this.logger.log("deleteView");
		const removedCovers = (await this.repo.deleteView(programId, episodeId, viewId)) ?? viewNotFound();
		await this.dropCovers(removedCovers);
	}

	// The S3 key of a cover given as an outside URL or a data URI; undefined for none or the proxy URL of a stored one
	private async newCoverKey(cover: string | undefined) {
		if (!cover || this.images.isOwnEpisodeCoverUrl(cover)) return undefined;
		let image: Buffer;
		try {
			image = await this.images.readEpisodeCover(cover);
		} catch (e) {
			this.logger.warn(`Can't read the cover ${cover.slice(0, 100)}: ${errorMessage(e)}`);
			throw new BadRequestError("invalid_image", "unreadable cover", { resource: "cover" });
		}
		return this.images.storeEpisodeCover(image);
	}

	// Covers no longer used; a failure only leaves an unused object behind
	private async dropCovers(keys: Array<string | null | undefined>) {
		for (const key of keys) {
			if (!key) continue;
			try {
				await this.images.deleteObject(key);
			} catch (e) {
				this.logger.warn(`Can't delete the cover ${key}: ${errorMessage(e)}`);
			}
		}
	}

	// The kept items of a list are the program's own
	private async assertOwnIds(programId: string, items: Array<{ id?: string }>, resource: "season" | "format") {
		const own = new Set(
			(await (resource === "season" ? this.repo.findSeasons(programId) : this.repo.findFormats(programId))).map(
				({ id }) => id,
			),
		);
		if (items.some(({ id }) => id && !own.has(id))) {
			throw new BadRequestError("invalid_reference", `not a ${resource} of the program`, { resource });
		}
	}

	// An episode's season and format are its program's
	private async assertGroups(programId: string, { seasonId, formatId }: { seasonId?: string; formatId?: string }) {
		if (seasonId && !(await this.repo.findSeasons(programId)).some(({ id }) => id === seasonId)) {
			throw new BadRequestError("invalid_reference", "not a season of the program", { resource: "season" });
		}
		if (formatId && !(await this.repo.findFormats(programId)).some(({ id }) => id === formatId)) {
			throw new BadRequestError("invalid_reference", "not a format of the program", { resource: "format" });
		}
	}

	// The credited entities must exist
	private async assertEntities(credits: Array<{ entityId: string }>) {
		const ids = [...new Set(credits.map(({ entityId }) => entityId))];
		if (ids.length && (await this.repo.countEntities(ids)) !== ids.length) {
			throw new BadRequestError("invalid_reference", "unknown entity", { resource: "entity" });
		}
	}

	private async findEpisode(programId: string, episodeId: string) {
		return (await this.repo.findEpisode(programId, episodeId)) ?? episodeNotFound();
	}

	private async findView(programId: string, episodeId: string, viewId: string) {
		const episode = await this.findEpisode(programId, episodeId);
		return episode.views.find(({ id }) => id === viewId) ?? viewNotFound();
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

	private async upload(programId: string, sources: Images, keep: (kind: BroadcastImageKind) => boolean) {
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
	private uploadMissingImages(program: ProgramDoc, sources: Images) {
		return this.upload(program.id, sources, (kind) => !program[kind]);
	}

	// An image already served by us (/images/broadcast/...) keeps its stored key
	private async uploadGivenImages(programId: string, current: ProgramDoc | null, sources: Images) {
		const images = await this.upload(programId, sources, (kind) => !this.images.isOwnUrl(sources[kind]!));
		for (const kind of ["profile", "banner"] as const) {
			if (sources[kind] && this.images.isOwnUrl(sources[kind]) && current?.[kind]) {
				images[kind] = current[kind];
			}
		}
		return images;
	}

	// A new program without images: from its YouTube channel, otherwise its podcast feed
	private async fetchImagesFromRefs(programId: string, refs?: ProgramDoc["refs"]): Promise<Images> {
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

function programNotFound(): never {
	throw new NotFoundError("program");
}

function episodeNotFound(): never {
	throw new NotFoundError("episode");
}

function viewNotFound(): never {
	throw new NotFoundError("view");
}
