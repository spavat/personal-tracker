import type { EpisodeDataFromSource, RefIdsEnum } from "@personal-tracker/shared/internet";

import { XMLParser } from "fast-xml-parser";

import { convertDurationInMinutes } from "./internet.entity";
interface EpisodeRSSData {
	guid: string;
	title: string;
	"itunes:duration": string | number;
	pubDate: string;
	link: string;
}
interface EpisodeYoutubeData {
	"yt:videoId": string;
	title: string;
	"itunes:duration": string;
	published: string;
}

export async function fetchLatestEpisodes(url: string, type: RefIdsEnum): Promise<Array<EpisodeDataFromSource>> {
	let rssLink = "";
	if (type === "rss") {
		rssLink = url;
	} else if (type === "youtubePlaylistId") {
		rssLink = `https://www.youtube.com/feeds/videos.xml?playlist_id=${url}`;
	} else if (type === "youtubeChannelId") {
		// Using the "official" feed of a channel returns both normal videos and shorts,
		// so we use a playlist feed with the UULF prefix to exclude shorts.
		rssLink = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULF${url.substring(2)}`;
	}

	const podcastData = await parseRSS(rssLink);

	let response: Array<EpisodeDataFromSource> = [];
	if (type === "rss") {
		// A feed with a single item is parsed as an object, not an array
		const items: Array<EpisodeRSSData> = [podcastData.rss.channel.item ?? []].flat();
		response = items.map((episode) => ({
			id: episode.guid,
			title: episode.title,
			duration: episode["itunes:duration"],
			durationInMinutes: convertDurationInMinutes(episode["itunes:duration"]),
			date: Temporal.Instant.fromEpochMilliseconds(new Date(episode.pubDate).getTime())
				.toZonedDateTimeISO("UTC")
				.toPlainDate()
				.toString(),
			type: "podcast",
			link: episode.link ?? "",
		}));
	} else {
		let entries: Array<EpisodeYoutubeData> = [];
		if (Array.isArray(podcastData.feed.entry)) {
			entries = podcastData.feed.entry;
		} else if (podcastData.feed.entry) {
			entries = [podcastData.feed.entry];
		}
		response = entries.map((episode) => ({
			id: episode["yt:videoId"],
			title: episode.title,
			duration: 0,
			durationInMinutes: 0,
			date: Temporal.Instant.fromEpochMilliseconds(new Date(episode.published).getTime())
				.toZonedDateTimeISO("UTC")
				.toPlainDate()
				.toString(),
			link: `https://www.youtube.com/watch?v=${episode["yt:videoId"]}`,
			type: "video",
		}));
	}

	response.sort((a, b) => b.date.localeCompare(a.date));
	return response;
}

export async function getPodcastCoverImageUrl(url: string): Promise<string | undefined> {
	const rssFeed = await fetchRSS(url);
	const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
	const result = parser.parse(rssFeed);
	return result?.rss?.channel?.["itunes:image"]?.["@_href"];
}

// 1. Récupérer le flux RSS via fetch
async function fetchRSS(url: string) {
	try {
		const response = await fetch(url);
		const rssFeed = await response.text();
		return rssFeed;
	} catch (error) {
		console.error("Erreur lors de la récupération du flux :", error);
		throw error;
	}
}

// 2. Parser le flux avec fast-xml-parser
async function parseRSS(url: string): Promise<any> {
	const rssFeed = await fetchRSS(url);
	const parser = new XMLParser({
		processEntities: {
			maxEntitySize: 2000,
		},
	});
	const result = parser.parse(rssFeed);
	return result;
}
