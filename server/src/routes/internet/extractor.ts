interface YoutubeAuthorInfos {
	name: string;
	description: string;
	type: "youtube" | "tv";
	channelId: string;
	url: string;
}

export interface YoutubeEpisodeInfos {
	id: string;
	title: string;
	author: YoutubeAuthorInfos;
	duration: number;
	durationInMinutes: number;
	uploadDate: string;
	link: string;
}

function getMinimalYoutubeUrl(inputUrl: string) {
	const url = new URL(inputUrl);
	const videoId = url.searchParams.get("v");

	if (!videoId) {
		throw new Error("No video ID found in URL");
	}

	return `https://www.youtube.com/watch?v=${videoId}`;
}

export async function getYoutubeVideoInfo(url: string): Promise<YoutubeEpisodeInfos> {
	const ytUrl = getMinimalYoutubeUrl(url);
	const res = await fetch(ytUrl);
	const html = await res.text();

	// Extract ytInitialPlayerResponse JSON
	const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);

	if (!match) {
		throw new Error("Could not find player response");
	}

	const playerResponse = JSON.parse(match[1]);
	console.log("playerResponse", playerResponse);
	const videoDetails = playerResponse.videoDetails;
	const microformat = playerResponse.microformat?.playerMicroformatRenderer;
	console.log("videoDetails", videoDetails);

	let channelData;
	try {
		channelData = await getYoutubeChannelInfo(`https://www.youtube.com/channel/${videoDetails.channelId}`);
	} catch (e) {
		console.error("Error parsing video details:", e);
	}
	return {
		id: videoDetails.videoId,
		title: videoDetails.title,
		author: {
			name: videoDetails.author,
			description: channelData.description,
			type: "youtube",
			channelId: videoDetails.channelId,
			url: microformat.ownerProfileUrl,
		},
		duration: Math.round(Number(videoDetails.lengthSeconds) / 60),
		durationInMinutes: Math.round(Number(videoDetails.lengthSeconds) / 60),
		uploadDate: microformat?.uploadDate,
		link: microformat.canonicalUrl,
	};
}

export async function getYoutubeChannelInfo(url: string): Promise<any> {
	const res = await fetch(url);
	const html = await res.text();

	// Extract ytInitialPlayerResponse JSON
	const match = html.match(/ytInitialData\s*=\s*(\{.+?\});/s);

	if (!match) {
		throw new Error("Could not find player response");
	}

	const playerResponse = JSON.parse(match[1]);
	const model = playerResponse.header.pageHeaderRenderer.content.pageHeaderViewModel;
	const channelData = playerResponse.metadata.channelMetadataRenderer;
	return {
		title: channelData?.title ?? "",
		description: channelData?.description ?? "",
		profile: model.image.decoratedAvatarViewModel.avatar.avatarViewModel.image.sources.at(-1),
		banner: model.banner?.imageBannerViewModel?.image?.sources?.at(-1) ?? null,
	};
}

function extractVideoObject(html: string): any {
	const scripts = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs);
	for (const [, json] of scripts) {
		try {
			const data = JSON.parse(json);
			const items = Array.isArray(data) ? data : (data["@graph"] ?? [data]);
			const video = items.find((item: any) => item["@type"] === "VideoObject");
			if (video) return video;
		} catch {
			// Invalid JSON-LD block, try the next one
		}
	}
	return null;
}

// "PT1H51M27S" -> 6687
export function isoDurationToSeconds(iso: string): number {
	const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
	if (!match) {
		throw new Error(`Invalid ISO duration: ${iso}`);
	}
	const [, hours = "0", minutes = "0", seconds = "0"] = match;
	return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

// "championnats-du-monde-de-cyclisme-sur-piste" -> "Championnats du monde de cyclisme sur piste"
function slugToName(slug: string) {
	const name = slug.replaceAll("-", " ");
	return name.charAt(0).toUpperCase() + name.slice(1);
}

export function parseFranceTvPage(html: string, url: string): YoutubeEpisodeInfos {
	const video = extractVideoObject(html);
	if (!video) {
		throw new Error("Could not find VideoObject");
	}

	const link: string = video.url ?? url;
	// https://www.france.tv/sport/cyclisme/<program>/<id>-<slug>.html
	const segments = new URL(link).pathname.split("/").filter(Boolean);
	const programSlug = segments.at(-2) ?? "";
	const durationInMinutes = Math.round(isoDurationToSeconds(video.duration) / 60);

	return {
		id: segments.at(-1)?.match(/^\d+/)?.[0] ?? "",
		title: video.name,
		author: {
			name: slugToName(programSlug),
			description: "",
			type: "tv",
			channelId: "",
			url: new URL(`/${segments.slice(0, -1).join("/")}/`, link).toString(),
		},
		duration: durationInMinutes,
		durationInMinutes,
		uploadDate: video.uploadDate,
		link,
	};
}

export async function getFranceTvVideoInfo(url: string): Promise<YoutubeEpisodeInfos> {
	const html = await getRawHTML(url);
	return parseFranceTvPage(html, url);
}

export async function getRawHTML(url: string): Promise<any> {
	const res = await fetch(url, {
		headers: {
			"User-Agent": "Mozilla/5.0",
		},
	});
	const html = await res.text();
	return html;
}
