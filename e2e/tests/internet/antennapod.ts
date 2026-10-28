import { DatabaseSync } from "node:sqlite";

// Minimal AntennaPod backup: only the tables and columns read by server/src/routes/internet/sync.entity.ts
type Listened = {
	feed: { title: string; url: string };
	title: string;
	guid: string;
	durationMin: number;
	playedMin: number;
	completedAt: string | null;
};

const LISTENED: Array<Listened> = [
	{
		feed: { title: "Mock Podcast", url: "https://feeds.example.com/mock-podcast.xml" },
		title: "Podcast épisode 3",
		guid: "mock-pod-3",
		durationMin: 50,
		playedMin: 50,
		completedAt: "2026-10-25T19:30:00Z",
	},
	{
		// Listened at 60%, at 3:30 (Paris): belongs to the previous day
		feed: { title: "Mock Podcast", url: "https://feeds.example.com/mock-podcast.xml" },
		title: "Podcast épisode 2",
		guid: "mock-pod-2",
		durationMin: 60,
		playedMin: 36,
		completedAt: "2026-10-26T02:30:00Z",
	},
	{
		// No program uses this feed
		feed: { title: "Third Podcast", url: "https://feeds.example.com/third-podcast.xml" },
		title: "Third épisode 1",
		guid: "third-1",
		durationMin: 20,
		playedMin: 20,
		completedAt: "2026-10-26T12:00:00Z",
	},
	{
		// Known program, but the episode isn't in its feed anymore
		feed: { title: "Second Podcast", url: "https://feeds.example.com/second-podcast.xml" },
		title: "Second épisode manquant",
		guid: "second-missing",
		durationMin: 30,
		playedMin: 15,
		completedAt: "2026-10-26T18:00:00Z",
	},
	{
		// Not finished: ignored
		feed: { title: "Mock Podcast", url: "https://feeds.example.com/mock-podcast.xml" },
		title: "Podcast épisode 4",
		guid: "mock-pod-4",
		durationMin: 35,
		playedMin: 10,
		completedAt: null,
	},
];

export function createAntennaPodBackup(path: string) {
	const db = new DatabaseSync(path);
	db.exec(`
		CREATE TABLE Feeds (id INTEGER PRIMARY KEY, title TEXT, download_url TEXT);
		CREATE TABLE FeedItems (id INTEGER PRIMARY KEY, title TEXT, feed INTEGER, item_identifier TEXT);
		CREATE TABLE FeedMedia (
			id INTEGER PRIMARY KEY,
			feeditem INTEGER,
			duration INTEGER,
			played_duration INTEGER,
			playback_completion_date INTEGER
		);
	`);
	const feedIds = new Map<string, number | bigint>();
	for (const { feed, title, guid, durationMin, playedMin, completedAt } of LISTENED) {
		if (!feedIds.has(feed.url)) {
			const { lastInsertRowid } = db
				.prepare("INSERT INTO Feeds (title, download_url) VALUES (?, ?)")
				.run(feed.title, feed.url);
			feedIds.set(feed.url, lastInsertRowid);
		}
		const { lastInsertRowid: itemId } = db
			.prepare("INSERT INTO FeedItems (title, feed, item_identifier) VALUES (?, ?, ?)")
			.run(title, feedIds.get(feed.url)!, guid);
		db.prepare(
			"INSERT INTO FeedMedia (feeditem, duration, played_duration, playback_completion_date) VALUES (?, ?, ?, ?)",
		).run(itemId, durationMin * 60_000, playedMin * 60_000, completedAt ? Date.parse(completedAt) : 0);
	}
	db.close();
	return path;
}
