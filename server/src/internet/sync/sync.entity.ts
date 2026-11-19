import type { GopodderEpisodeAction } from "@personal-tracker/shared/internet";

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const LISTENED_EPISODES_QUERY = `
SELECT
    fm.id AS episode_id,
	fi.title AS "episode title",
	f.title AS "podcast title",
	f.download_url AS podcast_url,
	fi.item_identifier AS episode_id,
    strftime('%Y-%m-%dT%H:%M:%SZ', fm.playback_completion_date / 1000, 'unixepoch') AS listened_at_iso,
	fm.duration,
	fm.played_duration,
	ROUND((CAST(fm.played_duration AS REAL) / fm.duration) * 100, 2) AS percent_listened
FROM FeedMedia fm
JOIN FeedItems fi ON fi.id = fm.feeditem
JOIN Feeds f ON fi.feed = f.id
WHERE fm.playback_completion_date IS NOT NULL AND fm.playback_completion_date > 0
ORDER BY fm.playback_completion_date ASC;
`;

interface ListenedEpisodeRow {
	episode_id: string;
	"episode title": string;
	"podcast title": string;
	podcast_url: string;
	listened_at_iso: string;
	duration: number;
	played_duration: number;
	percent_listened: number;
}

export interface ListenedEpisode {
	episodeId: string;
	episodeTitle: string;
	podcastTitle: string;
	podcastUrl: string;
	listenedAtIso: string;
	duration: number;
	playedDuration: number;
	percentListened: number;
}

function extractListenedEpisodes(dbPath: string): Array<ListenedEpisode> {
	const db = new DatabaseSync(dbPath, { readOnly: true });
	try {
		const rows = db.prepare(LISTENED_EPISODES_QUERY).all() as unknown as Array<ListenedEpisodeRow>;

		return rows.map((row) => ({
			episodeId: row.episode_id,
			episodeTitle: row["episode title"],
			podcastTitle: row["podcast title"],
			podcastUrl: row.podcast_url,
			listenedAtIso: row.listened_at_iso,
			duration: row.duration,
			playedDuration: row.played_duration,
			percentListened: row.percent_listened,
		}));
	} finally {
		db.close();
	}
}

// Below this total listening time (sum of the played segments), a play is a stray tap or seek
const MIN_LISTENED_SECONDS = 30;

// gopodder sends one "play" action per pause/stop: merge them per episode (furthest position, last action date)
export function aggregateEpisodeActions(actions: Array<GopodderEpisodeAction>): Array<ListenedEpisode> {
	const byEpisode = new Map<
		string,
		{ podcastUrl: string; episodeId: string; timestamp: string; position: number; total: number; heard: number }
	>();
	for (const action of actions) {
		if (action.action !== "play") continue;
		const episodeId = action.guid ?? action.episode;
		const key = `${action.podcast}\n${episodeId}`;
		const position = action.position ?? 0;
		const heard = Math.max(0, position - (action.started ?? 0));
		const current = byEpisode.get(key);
		if (!current) {
			byEpisode.set(key, {
				podcastUrl: action.podcast,
				episodeId,
				timestamp: action.timestamp,
				position,
				total: action.total ?? 0,
				heard,
			});
			continue;
		}
		current.position = Math.max(current.position, position);
		current.total = Math.max(current.total, action.total ?? 0);
		current.heard += heard;
		if (action.timestamp > current.timestamp) current.timestamp = action.timestamp;
	}

	return [...byEpisode.values()]
		.filter((episode) => episode.heard >= MIN_LISTENED_SECONDS)
		.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
		.map((episode) => ({
			episodeId: episode.episodeId,
			episodeTitle: "",
			podcastTitle: "",
			podcastUrl: episode.podcastUrl,
			// gopodder timestamps are UTC without zone suffix
			listenedAtIso: `${episode.timestamp}Z`,
			duration: episode.total * 1000,
			playedDuration: episode.position * 1000,
			percentListened: episode.total ? Math.round((episode.position / episode.total) * 10000) / 100 : 0,
		}));
}

export function extractListenedEpisodesFromBuffer(content: Uint8Array): Array<ListenedEpisode> {
	const dir = mkdtempSync(join(tmpdir(), "antennapod-"));
	const dbPath = join(dir, "backup.db");
	try {
		writeFileSync(dbPath, content);
		return extractListenedEpisodes(dbPath);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}
