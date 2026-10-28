import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchLatestEpisodes } from "./fetch-latest";

function stubFetchReturning(xml: string) {
	const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(xml) });
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("fetchLatestEpisodes (rss)", () => {
	it("maps RSS items to episodes sorted newest first", async () => {
		const fetchMock = stubFetchReturning(`<?xml version="1.0"?>
<rss><channel>
  <item><guid>g1</guid><title>Older</title><itunes:duration>10:00</itunes:duration><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate><link>http://a/1</link></item>
  <item><guid>g2</guid><title>Newer</title><itunes:duration>20:00</itunes:duration><pubDate>Wed, 03 Jan 2024 00:00:00 GMT</pubDate><link>http://a/2</link></item>
</channel></rss>`);

		const result = await fetchLatestEpisodes("http://feed.example/rss", "rss");

		expect(fetchMock).toHaveBeenCalledWith("http://feed.example/rss");
		expect(result).toEqual([
			{
				id: "g2",
				title: "Newer",
				duration: "20:00",
				durationInMinutes: 20,
				date: "2024-01-03",
				type: "podcast",
				link: "http://a/2",
			},
			{
				id: "g1",
				title: "Older",
				duration: "10:00",
				durationInMinutes: 10,
				date: "2024-01-01",
				type: "podcast",
				link: "http://a/1",
			},
		]);
	});

	it("handles a feed with a single item", async () => {
		stubFetchReturning(`<?xml version="1.0"?>
<rss><channel>
  <item><guid>g1</guid><title>Only</title><itunes:duration>10:00</itunes:duration><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate><link>http://a/1</link></item>
</channel></rss>`);

		const result = await fetchLatestEpisodes("http://feed.example/rss", "rss");

		expect(result.map((e) => e.id)).toEqual(["g1"]);
	});

	it("handles a feed without item", async () => {
		stubFetchReturning(`<?xml version="1.0"?><rss><channel><title>Empty</title></channel></rss>`);

		expect(await fetchLatestEpisodes("http://feed.example/rss", "rss")).toEqual([]);
	});
});

describe("fetchLatestEpisodes (youtube)", () => {
	it("builds the playlist feed url and maps entries to video episodes", async () => {
		const fetchMock = stubFetchReturning(`<?xml version="1.0"?>
<feed>
  <entry><yt:videoId>v1</yt:videoId><title>Vid 1</title><published>2024-01-02T00:00:00Z</published></entry>
</feed>`);

		const result = await fetchLatestEpisodes("PL123", "youtubePlaylistId");

		expect(fetchMock).toHaveBeenCalledWith("https://www.youtube.com/feeds/videos.xml?playlist_id=PL123");
		expect(result).toEqual([
			{
				id: "v1",
				title: "Vid 1",
				duration: 0,
				durationInMinutes: 0,
				date: "2024-01-02",
				link: "https://www.youtube.com/watch?v=v1",
				type: "video",
			},
		]);
	});
});
