import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { CatalogEpisode } from "./episode-feed.client.js";

import { UpstreamError } from "../../common/errors.js";
import { Env } from "../../config/env.schema.js";
import { isoDurationToSeconds } from "./video-info.client.js";
import { youtubeThumbnail } from "./youtube-link.utils.js";

const API_URL = "https://www.googleapis.com/youtube/v3";
// the most items a page / a call gives
const PAGE_SIZE = 50;
// a short is at most 3 minutes long
const SHORT_MAX_SECONDS = 180;

interface PlaylistItemsPage {
	nextPageToken?: string;
	// a private / deleted video has no videoPublishedAt
	items: Array<{ contentDetails: { videoId: string; videoPublishedAt?: string } }>;
}
interface VideosPage {
	items: Array<{
		id: string;
		snippet: { title: string; description?: string; publishedAt: string; liveBroadcastContent?: string };
		contentDetails: { duration: string };
	}>;
}

// The uploads of a channel without its shorts (the "UULF" playlist, as the RSS feed of the latest episodes)
export const channelUploadsPlaylist = (channelId: string) => `UULF${channelId.substring(2)}`;

// YouTube Data API v3 with an API key: a playlist's videos for the catalog import, given videos to complete a feed. Each call costs 1 quota unit
// (10,000 a day): a playlist of N videos costs 2 × ⌈N / 50⌉.
@Injectable()
export class YoutubeDataClient {
	private readonly apiKey: string;

	constructor(config: ConfigService<Env, true>) {
		this.apiKey = config.get("YOUTUBE_API_KEY", { infer: true });
	}

	// The released videos of the playlist (the private / deleted ones, the upcoming lives and premieres left out;
	// the shorts too with `skipShorts`), in the playlist's order
	async fetchPlaylistVideos(playlistId: string, { skipShorts }: { skipShorts: boolean }) {
		this.assertConfigured();
		const episodes: CatalogEpisode[] = [];
		let pageToken: string | undefined;
		do {
			const page = await this.get<PlaylistItemsPage>("playlistItems", {
				part: "contentDetails",
				playlistId,
				maxResults: String(PAGE_SIZE),
				...(pageToken ? { pageToken } : {}),
			});
			const ids = page.items
				.filter(({ contentDetails }) => contentDetails.videoPublishedAt)
				.map(({ contentDetails }) => contentDetails.videoId);
			episodes.push(...(await this.videos(ids, skipShorts)));
			pageToken = page.nextPageToken;
		} while (pageToken);
		return episodes;
	}

	// The given videos, shorts included, 50 per call (the private / deleted ones and the upcoming lives and premieres
	// left out): what completes the stored videos of a feed without reading the whole channel
	async fetchVideos(ids: string[]) {
		this.assertConfigured();
		const episodes: CatalogEpisode[] = [];
		for (let start = 0; start < ids.length; start += PAGE_SIZE) {
			episodes.push(...(await this.videos(ids.slice(start, start + PAGE_SIZE), false)));
		}
		return episodes;
	}

	private assertConfigured() {
		if (!this.apiKey) {
			throw new UpstreamError("upstream_unavailable", "YouTube is not configured", { service: "YouTube" });
		}
	}

	// At most 50 ids, in their order
	private async videos(ids: string[], skipShorts: boolean) {
		const episodes: CatalogEpisode[] = [];
		if (!ids.length) return episodes;
		const videos = await this.get<VideosPage>("videos", { part: "snippet,contentDetails", id: ids.join(",") });
		const byId = new Map(videos.items.map((video) => [video.id, video]));
		for (const id of ids) {
			const video = byId.get(id);
			if (!video || (video.snippet.liveBroadcastContent ?? "none") !== "none") continue;
			const seconds = isoDurationToSeconds(video.contentDetails.duration);
			if (skipShorts && seconds <= SHORT_MAX_SECONDS) continue;
			const description = video.snippet.description?.trim();
			episodes.push({
				externalId: id,
				name: video.snippet.title,
				releaseDate: video.snippet.publishedAt.slice(0, 10),
				duration: Math.round(seconds / 60),
				link: `https://www.youtube.com/watch?v=${id}`,
				...(description ? { description } : {}),
				cover: youtubeThumbnail(id),
			});
		}
		return episodes;
	}

	private async get<T>(resource: string, params: Record<string, string>): Promise<T> {
		const url = `${API_URL}/${resource}?${new URLSearchParams({ ...params, key: this.apiKey })}`;
		const response = await fetch(url);
		if (!response.ok) {
			throw new UpstreamError("upstream_unavailable", `YouTube answered ${response.status}`, {
				service: "YouTube",
				status: response.status,
			});
		}
		return (await response.json()) as T;
	}
}
