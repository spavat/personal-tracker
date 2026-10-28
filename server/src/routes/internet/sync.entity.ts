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
