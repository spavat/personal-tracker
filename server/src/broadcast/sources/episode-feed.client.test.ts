import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCatalogEpisodes, fetchLatestEpisodes } from "./episode-feed.client.js";

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
				cover: "https://i.ytimg.com/vi/v1/mqdefault.jpg",
			},
		]);
	});

	it("reads the description of the media group", async () => {
		stubFetchReturning(`<?xml version="1.0"?>
<feed>
  <entry><yt:videoId>v1</yt:videoId><title>Vid 1</title><published>2024-01-02T00:00:00Z</published>
    <media:group><media:thumbnail url="https://i1.ytimg.com/vi/v1/hqdefault.jpg" width="480" height="360"/><media:description>Line 1
Line 2</media:description></media:group></entry>
</feed>`);

		const [episode] = await fetchLatestEpisodes("PL123", "youtubePlaylistId");

		expect(episode).toMatchObject({
			description: "Line 1\nLine 2",
			cover: "https://i.ytimg.com/vi/v1/mqdefault.jpg",
		});
	});
});

describe("descriptions and covers of an RSS feed", () => {
	it("takes the description, else itunes:summary, else content:encoded, as text; the item's own image", async () => {
		stubFetchReturning(`<?xml version="1.0"?>
<rss><channel><itunes:image href="https://img/channel.jpg"/>
  <item><guid>g1</guid><title>Html</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    <description><![CDATA[<p>Un <b>épisode</b> d&eacute;taillé</p><p>Suite</p>]]></description><itunes:summary>Not this one</itunes:summary>
    <itunes:image href="https://img/g1.jpg"/></item>
  <item><guid>g2</guid><title>Summary</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    <description> </description><itunes:summary>Le résumé</itunes:summary><itunes:image href="https://img/channel.jpg"/></item>
  <item><guid>g3</guid><title>Encoded</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    <content:encoded><![CDATA[Ligne<br/>suivante]]></content:encoded></item>
</channel></rss>`);

		const items = await fetchCatalogEpisodes("http://feed.example/rss");

		expect(items.map(({ description, cover }) => ({ description, cover }))).toEqual([
			{ description: "Un épisode détaillé\n\nSuite", cover: "https://img/g1.jpg" },
			// the channel's image is the program's
			{ description: "Le résumé", cover: undefined },
			{ description: "Ligne\nsuivante", cover: undefined },
		]);
		// the latest episodes read them the same way
		expect((await fetchLatestEpisodes("http://feed.example/rss", "rss"))[0]).toMatchObject({
			description: "Un épisode détaillé\n\nSuite",
			cover: "https://img/g1.jpg",
		});
	});
});

describe("fetchCatalogEpisodes", () => {
	it("maps every item with a guid, its itunes season and number; a bonus / trailer is labelled so", async () => {
		stubFetchReturning(`<?xml version="1.0"?>
<rss><channel>
  <item><guid isPermaLink="false">g3</guid><title>Bonus</title><pubDate>Wed, 03 Jan 2024 00:00:00 GMT</pubDate><itunes:season>2</itunes:season><itunes:episode>4</itunes:episode><itunes:episodeType>bonus</itunes:episodeType></item>
  <item><guid>g2</guid><title>1984</title><itunes:duration>3600</itunes:duration><pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate><link>http://a/2</link><itunes:season>2</itunes:season><itunes:episode>1</itunes:episode></item>
  <item><guid>g1</guid><title>No date</title><pubDate>someday</pubDate></item>
  <item><title>No guid</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>
</channel></rss>`);

		expect(await fetchCatalogEpisodes("http://feed.example/rss")).toEqual([
			{
				externalId: "g3",
				name: "Bonus",
				releaseDate: "2024-01-03",
				duration: 0,
				season: 2,
				position: 4,
				numberLabel: "Bonus",
			},
			{
				externalId: "g2",
				name: "1984",
				releaseDate: "2024-01-02",
				duration: 60,
				link: "http://a/2",
				season: 2,
				position: 1,
				numberLabel: "1",
			},
			{ externalId: "g1", name: "No date", duration: 0 },
		]);
	});
});
