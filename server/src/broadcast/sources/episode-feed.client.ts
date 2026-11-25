import type { EpisodeDataFromSource, RefIdsEnum } from "@personal-tracker/shared/broadcast";

import { XMLParser } from "fast-xml-parser";

import { convertDurationInMinutes } from "../broadcast.entity.js";
import { htmlToText } from "./html-text.utils.js";
import { youtubeThumbnail } from "./youtube-link.utils.js";
interface EpisodeRSSData {
	guid: string;
	title: string;
	"itunes:duration": string | number;
	pubDate: string;
	link: string;
	"itunes:season"?: number | string;
	"itunes:episode"?: number | string;
	"itunes:episodeType"?: string;
	description?: string;
	"itunes:summary"?: string;
	"content:encoded"?: string;
	"itunes:image"?: { "@_href"?: string };
}

// A release of a feed, as the catalog import saves it
export interface CatalogEpisode {
	externalId: string;
	name: string;
	// undefined when the pubDate can't be read
	releaseDate?: string;
	// minutes, 0 when the feed gives none
	duration: number;
	link?: string;
	// itunes:season / itunes:episode
	season?: number;
	position?: number;
	numberLabel?: string;
	// plain text, and the URL of the item's own image
	description?: string;
	cover?: string;
}

const EPISODE_TYPE_LABELS: Partial<Record<string, string>> = { bonus: "Bonus", trailer: "Bande-annonce" };

const toInteger = (value: unknown) => {
	const number = Number(value);
	return Number.isInteger(number) && number > 0 ? number : undefined;
};

// Every item of the RSS feed with a guid, as they come: `itunes:episodeType` bonus / trailer is their number label,
// otherwise `itunes:episode`
export async function fetchCatalogEpisodes(url: string): Promise<Array<CatalogEpisode>> {
	const channel = (await parseRSS(url))?.rss?.channel;
	const items: Array<EpisodeRSSData> = [channel?.item ?? []].flat();
	return items
		.filter(({ guid }) => guid !== undefined && guid !== "")
		.map((item) => {
			const position = toInteger(item["itunes:episode"]);
			const numberLabel =
				EPISODE_TYPE_LABELS[String(item["itunes:episodeType"] ?? "").toLowerCase()] ??
				(position === undefined ? undefined : String(position));
			const releaseDate = Number.isNaN(new Date(item.pubDate).getTime()) ? undefined : toPlainDate(item.pubDate);
			return {
				externalId: String(item.guid),
				name: String(item.title),
				...(releaseDate ? { releaseDate } : {}),
				duration: convertDurationInMinutes(item["itunes:duration"]),
				...(item.link ? { link: String(item.link) } : {}),
				...(toInteger(item["itunes:season"]) ? { season: toInteger(item["itunes:season"]) } : {}),
				...(position ? { position } : {}),
				...(numberLabel ? { numberLabel } : {}),
				...itemExtras(item, channelImage(channel)),
			};
		});
}

const channelImage = (channel: any): string | undefined => channel?.["itunes:image"]?.["@_href"];

// The item's description (the first one given: description, itunes:summary, content:encoded) as plain text, and its
// own image (the channel's one is the program's)
function itemExtras(item: EpisodeRSSData, programImage: string | undefined) {
	const html = [item.description, item["itunes:summary"], item["content:encoded"]].find(
		(value) => value !== undefined && String(value).trim() !== "",
	);
	const description = html === undefined ? "" : htmlToText(String(html));
	const cover = item["itunes:image"]?.["@_href"];
	return {
		...(description ? { description } : {}),
		...(cover && cover !== programImage ? { cover } : {}),
	};
}

// A YouTube video's 16:9 thumbnail (the feed's hqdefault one has black bars)

const toPlainDate = (date: string) =>
	Temporal.Instant.fromEpochMilliseconds(new Date(date).getTime()).toZonedDateTimeISO("UTC").toPlainDate().toString();
interface EpisodeYoutubeData {
	"yt:videoId": string;
	title: string;
	"itunes:duration": string;
	published: string;
	"media:group"?: { "media:description"?: string };
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
		const programImage = channelImage(podcastData.rss.channel);
		response = items.map((episode) => ({
			id: String(episode.guid),
			title: String(episode.title),
			duration: episode["itunes:duration"] ?? 0,
			durationInMinutes: convertDurationInMinutes(episode["itunes:duration"]),
			date: Temporal.Instant.fromEpochMilliseconds(new Date(episode.pubDate).getTime())
				.toZonedDateTimeISO("UTC")
				.toPlainDate()
				.toString(),
			type: "podcast",
			link: episode.link ?? "",
			...itemExtras(episode, programImage),
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
			...(episode["media:group"]?.["media:description"]
				? { description: String(episode["media:group"]["media:description"]).trim() }
				: {}),
			cover: youtubeThumbnail(episode["yt:videoId"]),
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

export async function fetchPodcastTitle(url: string): Promise<string | undefined> {
	const result = await parseRSS(url);
	const title = result?.rss?.channel?.title;
	return title === undefined ? undefined : String(title);
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
		// only the image URLs (itunes:image href): with more, a tag like <guid isPermaLink> would become an object
		ignoreAttributes: (name) => name !== "href",
		attributeNamePrefix: "@_",
		processEntities: {
			maxEntitySize: 2000,
		},
	});
	const result = parser.parse(rssFeed);
	return result;
}
