// Preloaded in the e2e server (see playwright.config.ts): replaces the external calls made with the global fetch
// (Youtube, RSS feeds, france.tv, images) by the fixtures in ./responses, so the tests never hit the network.
// Any external URL missing from ROUTES throws, so a forgotten mock is visible in the server logs.
import { readFileSync } from "node:fs";

const HTML = "text/html; charset=utf-8";
const XML = "application/xml; charset=utf-8";
const SVG = "image/svg+xml";

const MOCK_TUBE = "UCmocktube00000000000001";
const NEW_CHANNEL = "UCnewchannel000000000001";

const ROUTES = {
	// Youtube channels (the server uses both www and non-www URLs)
	[`https://www.youtube.com/channel/${MOCK_TUBE}`]: ["youtube-channel-mocktube.html", HTML],
	[`https://youtube.com/channel/${MOCK_TUBE}`]: ["youtube-channel-mocktube.html", HTML],
	[`https://www.youtube.com/channel/${NEW_CHANNEL}`]: ["youtube-channel-newchannel.html", HTML],
	[`https://youtube.com/channel/${NEW_CHANNEL}`]: ["youtube-channel-newchannel.html", HTML],
	// Youtube videos
	"https://www.youtube.com/watch?v=vid00000006": ["youtube-watch-vid00000006.html", HTML],
	"https://www.youtube.com/watch?v=newvideo001": ["youtube-watch-newvideo001.html", HTML],
	// Youtube channel feed: playlist "UULF" + channel id without "UC" (videos without shorts)
	[`https://www.youtube.com/feeds/videos.xml?playlist_id=UULF${MOCK_TUBE.substring(2)}`]: [
		"youtube-feed-mocktube.xml",
		XML,
	],
	// Podcasts
	"https://feeds.example.com/mock-podcast.xml": ["podcast-mock.xml", XML],
	"https://feeds.example.com/second-podcast.xml": ["podcast-second.xml", XML],
	"https://feeds.example.com/third-podcast.xml": ["podcast-third.xml", XML],
	// france.tv
	"https://www.france.tv/sport/cyclisme/tour-de-france/7000001-etape-15.html": ["francetv-etape-15.html", HTML],
	// Images
	"https://images.example.com/mocktube-profile.svg": ["profile.svg", SVG],
	"https://images.example.com/mocktube-banner.svg": ["banner.svg", SVG],
	"https://images.example.com/newchannel-profile.svg": ["profile.svg", SVG],
	"https://images.example.com/newchannel-banner.svg": ["banner.svg", SVG],
	"https://images.example.com/podcast-cover.svg": ["profile.svg", SVG],
};

const realFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
	const { hostname } = new URL(url);
	if (hostname === "localhost" || hostname === "127.0.0.1") {
		return realFetch(input, init);
	}

	const route = ROUTES[url];
	if (!route) {
		console.error(`[fetch-mock] Unmocked external request: ${url}`);
		throw new Error(`Unmocked external request: ${url}`);
	}
	const [file, contentType] = route;
	const body = readFileSync(new URL(`./responses/${file}`, import.meta.url));
	return new Response(body, { status: 200, headers: { "content-type": contentType } });
};
