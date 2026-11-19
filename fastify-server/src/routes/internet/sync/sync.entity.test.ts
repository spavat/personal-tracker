import { describe, expect, it } from "vitest";

import { aggregateEpisodeActions } from "./sync.entity";

const play = {
	podcast: "http://feed",
	episode: "http://feed/ep1.mp3",
	guid: "guid-1",
	action: "play",
	timestamp: "2026-11-12T19:00:00",
	started: 0,
	position: 600,
	total: 3600,
};

describe("aggregateEpisodeActions", () => {
	it("maps a play action to a listened episode, with a UTC date", () => {
		expect(aggregateEpisodeActions([play])).toEqual([
			{
				episodeId: "guid-1",
				episodeTitle: "",
				podcastTitle: "",
				podcastUrl: "http://feed",
				listenedAtIso: "2026-11-12T19:00:00Z",
				duration: 3_600_000,
				playedDuration: 600_000,
				percentListened: 16.67,
			},
		]);
	});

	it("merges the actions of one episode: furthest position, last action date", () => {
		const [episode, ...others] = aggregateEpisodeActions([
			{ ...play, timestamp: "2026-11-13T08:00:00", started: 600, position: 3600 },
			play,
			{ ...play, timestamp: "2026-11-12T21:00:00", started: 1200, position: 1500 },
		]);
		expect(others).toEqual([]);
		expect(episode).toMatchObject({
			listenedAtIso: "2026-11-13T08:00:00Z",
			playedDuration: 3_600_000,
			percentListened: 100,
		});
	});

	it("keeps episodes apart by feed and guid, sorted by date", () => {
		const episodes = aggregateEpisodeActions([
			{ ...play, guid: "guid-2", timestamp: "2026-11-12T20:00:00" },
			play,
			{ ...play, podcast: "http://other", timestamp: "2026-11-12T18:00:00" },
		]);
		expect(episodes.map((e) => [e.podcastUrl, e.episodeId])).toEqual([
			["http://other", "guid-1"],
			["http://feed", "guid-1"],
			["http://feed", "guid-2"],
		]);
	});

	it("drops plays under 30 seconds of total listening (stray taps, seeks)", () => {
		expect(
			aggregateEpisodeActions([
				{ ...play, started: 120, position: 125 },
				{ ...play, started: 2000, position: 2020 },
				{ ...play, guid: "guid-2", started: 0, position: 30 },
			]).map((e) => e.episodeId),
		).toEqual(["guid-2"]);
	});

	it("ignores non-play actions and falls back to the media url without guid", () => {
		const { guid: _guid, ...withoutGuid } = play;
		expect(aggregateEpisodeActions([{ ...play, action: "download" }, withoutGuid]).map((e) => e.episodeId)).toEqual(
			["http://feed/ep1.mp3"],
		);
	});
});
