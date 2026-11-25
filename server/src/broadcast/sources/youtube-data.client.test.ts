import { afterEach, describe, expect, it, vi } from "vitest";

import { UpstreamError } from "../../common/errors.js";
import { YoutubeDataClient } from "./youtube-data.client.js";

const client = (apiKey = "key") => new YoutubeDataClient({ get: () => apiKey } as never);

const video = (id: string, duration: string, extra: object = {}) => ({
	id,
	snippet: { title: `Video ${id}`, publishedAt: "2024-01-02T22:00:00Z", liveBroadcastContent: "none", ...extra },
	contentDetails: { duration },
});
const item = (videoId: string, published = true) => ({
	contentDetails: { videoId, ...(published ? { videoPublishedAt: "2024-01-02T22:00:00Z" } : {}) },
});

// the answers of the API, by resource and page token
function stubApi(answers: Record<string, unknown>) {
	const fetchMock = vi.fn(async (url: string) => {
		const { pathname, searchParams } = new URL(url);
		const key = `${pathname.split("/").at(-1)}${searchParams.get("pageToken") ? `:${searchParams.get("pageToken")}` : ""}`;
		const body = answers[key];
		return body === undefined
			? new Response("", { status: 403 })
			: new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("YoutubeDataClient", () => {
	it("reads every page of the playlist and the details of its released videos", async () => {
		const fetchMock = stubApi({
			playlistItems: { nextPageToken: "p2", items: [item("v1"), item("gone", false)] },
			"playlistItems:p2": { items: [item("v2"), item("live")] },
			videos: {
				items: [
					video("v1", "PT1H2M30S", { description: "  About v1\n" }),
					video("v2", "PT2M"),
					video("live", "P0D", { liveBroadcastContent: "upcoming" }),
				],
			},
		});

		const episodes = await client().fetchPlaylistVideos("PL1", { skipShorts: false });

		expect(episodes).toEqual([
			{
				externalId: "v1",
				name: "Video v1",
				releaseDate: "2024-01-02",
				duration: 63,
				link: "https://www.youtube.com/watch?v=v1",
				description: "About v1",
				cover: "https://i.ytimg.com/vi/v1/mqdefault.jpg",
			},
			{
				externalId: "v2",
				name: "Video v2",
				releaseDate: "2024-01-02",
				duration: 2,
				link: "https://www.youtube.com/watch?v=v2",
				cover: "https://i.ytimg.com/vi/v2/mqdefault.jpg",
			},
		]);
		// the private / deleted video is never asked for
		const videoCalls = fetchMock.mock.calls
			.map(([url]) => new URL(url))
			.filter((url) => url.pathname.endsWith("/videos"));
		expect(videoCalls.map((url) => url.searchParams.get("id"))).toEqual(["v1", "v2,live"]);
		expect(videoCalls[0].searchParams.get("key")).toBe("key");
	});

	it("leaves the shorts out when asked", async () => {
		stubApi({
			playlistItems: { items: [item("long"), item("short")] },
			videos: { items: [video("long", "PT3M1S"), video("short", "PT3M")] },
		});

		const episodes = await client().fetchPlaylistVideos("PL1", { skipShorts: true });

		expect(episodes.map(({ externalId }) => externalId)).toEqual(["long"]);
	});

	it("reads given videos 50 per call, shorts included, without the missing ones", async () => {
		const ids = Array.from({ length: 51 }, (_, n) => `v${n}`);
		const fetchMock = stubApi({ videos: { items: [video("v0", "PT1M"), video("v50", "PT20M")] } });

		const episodes = await client().fetchVideos(ids);

		expect(episodes.map(({ externalId, duration }) => [externalId, duration])).toEqual([
			["v0", 1],
			["v50", 20],
		]);
		const calls = fetchMock.mock.calls.map(([url]) => new URL(url));
		expect(calls.map((url) => url.pathname.split("/").at(-1))).toEqual(["videos", "videos"]);
		expect(calls.map((url) => url.searchParams.get("id")?.split(",").length)).toEqual([50, 1]);
	});

	it("asks nothing for no video", async () => {
		const fetchMock = stubApi({});
		expect(await client().fetchVideos([])).toEqual([]);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("is not configured without an API key, and answers the status of a refused call", async () => {
		await expect(client("").fetchPlaylistVideos("PL1", { skipShorts: false })).rejects.toMatchObject({
			code: "upstream_unavailable",
			params: { service: "YouTube" },
		});
		stubApi({});
		const refused = client().fetchPlaylistVideos("PL1", { skipShorts: false });
		await expect(refused).rejects.toBeInstanceOf(UpstreamError);
		await expect(refused).rejects.toMatchObject({ params: { service: "YouTube", status: 403 } });
	});
});
