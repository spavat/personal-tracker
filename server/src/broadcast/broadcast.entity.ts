import type { EpisodeCredit, EpisodeStatus, ProgramCredit, Tracking } from "@personal-tracker/shared/broadcast";

// A listening / watching of an episode
export interface ViewDoc {
	id: string;
	date: string;
	// minutes watched, when not the whole episode
	duration?: number;
	contextTags?: Array<string>;
	comment?: string;
	created?: string;
}

// A release, with its views (oldest first)
export interface EpisodeDoc {
	id: string;
	name: string;
	shortName?: string;
	duration: number;
	type: string;
	releaseDate?: string;
	link?: string;
	tags?: Array<string>;
	ignoredTags?: Array<string>;
	externalId?: string;
	seasonId?: string;
	formatId?: string;
	position?: number;
	numberLabel?: string;
	status?: EpisodeStatus;
	description?: string;
	// the proxy URL of its cover
	cover?: string;
	credits: Array<EpisodeCredit>;
	views: Array<ViewDoc>;
}

// Episode covers are stored as personal-tracker/broadcast/episode/<version>.avif (the version is random: the key is
// made before a new episode has an id) and served through the images proxy; a replaced cover gets a new URL.
export const EPISODE_COVER_URL_PREFIX = "/images/broadcast/episode/";

export const episodeCoverKey = (version: string) => `personal-tracker/broadcast/episode/${version}.avif`;

export function episodeCoverUrl(episodeId: string, key: string | null) {
	return key ? `${EPISODE_COVER_URL_PREFIX}${episodeId}?v=${key.split("/").at(-1)!.split(".")[0]}` : undefined;
}

// A program as the API answers it: `author` and `network` are the names of its credits joined with " && "
export interface ProgramDoc {
	id: string;
	name: string;
	shortName?: string;
	author?: string;
	country?: string;
	network?: string;
	tracking: Tracking;
	credits: Array<ProgramCredit>;
	links?: Array<string>;
	profile?: string;
	banner?: string;
	episodes: Array<EpisodeDoc>;
	tags?: Array<string>;
	refs?: Partial<Record<string, string>>;
	description?: string;
	type?: string;
	private?: boolean;
}

// The time a view counts for: what was watched, else the whole episode
export function viewDuration(episode: Pick<EpisodeDoc, "duration">, view: Pick<ViewDoc, "duration">) {
	return view.duration ?? episode.duration;
}

// Every view of these episodes, with its episode
export function viewsOf(episodes: Array<EpisodeDoc>) {
	return episodes.flatMap((episode) => episode.views.map((view) => ({ episode, view })));
}

// Latest first: by date, then by creation
export function sortViewsDesc(a: Pick<ViewDoc, "date" | "created">, b: Pick<ViewDoc, "date" | "created">) {
	if (b.date === a.date) {
		return (b.created ?? "").localeCompare(a.created ?? "");
	}
	return b.date.localeCompare(a.date);
}

const latestView = (episode: EpisodeDoc) => episode.views.toSorted(sortViewsDesc)[0];

// The episode watched last first (an episode without view last)
export function sortEpisodesDesc(a: EpisodeDoc, b: EpisodeDoc) {
	const [viewA, viewB] = [latestView(a), latestView(b)];
	if (!viewA || !viewB) return Number(!viewA) - Number(!viewB);
	return sortViewsDesc(viewA, viewB);
}

// Tags of an episode: the program tags it does not ignore, plus its own (each once)
export function getEpisodeTags(
	programTags: Array<string> | undefined,
	episode: Pick<EpisodeDoc, "tags" | "ignoredTags">,
): Array<string> {
	const ignored = episode.ignoredTags ?? [];
	return [...new Set([...(programTags ?? []).filter((tag) => !ignored.includes(tag)), ...(episode.tags ?? [])])];
}

// Figures of a program over its views (an episode watched twice counts twice); releases / watched count episodes
export function getDetails(program: Pick<ProgramDoc, "episodes">) {
	const views = viewsOf(program.episodes);
	const totalDuration = views.reduce((sum, { episode }) => sum + episode.duration, 0);
	const totalDurationReal = views.reduce((sum, { episode, view }) => sum + viewDuration(episode, view), 0);
	const lastSeen = views.map(({ view }) => view).toSorted(sortViewsDesc)[0];
	return {
		episodes: views.length,
		averageLength: views.length > 0 ? Math.round(totalDuration / views.length) : 0,
		completionRate: views.length > 0 ? Math.round((totalDurationReal / totalDuration) * 100) : 0,
		lastSeenDate: lastSeen?.date ?? "",
		releases: program.episodes.length,
		watched: program.episodes.filter(({ views }) => views.length > 0).length,
		skipped: program.episodes.filter(({ status }) => status === "skipped").length,
	};
}

// Oldest release first, an episode without release date last; then by its number in the season, its name
export function byRelease(a: Pick<EpisodeDoc, "releaseDate" | "position" | "name">, b: typeof a) {
	if (a.releaseDate !== b.releaseDate) {
		if (!a.releaseDate) return 1;
		if (!b.releaseDate) return -1;
		return a.releaseDate.localeCompare(b.releaseDate);
	}
	return (a.position ?? Infinity) - (b.position ?? Infinity) || a.name.localeCompare(b.name);
}

export function sortByDuration(obj1: { duration: number }, obj2: { duration: number }) {
	return obj2.duration - obj1.duration;
}

export function convertDurationInMinutes(duration: string | number): number {
	// Format: mm:ss or hh:mm:ss
	if (!duration) {
		return 0;
	}

	if (typeof duration === "number") {
		if (duration > 120) {
			// Probably seconds?
			return Math.round(duration / 60);
		}
		return duration;
	}

	const parts = duration.split(":");
	if (!parts.length) {
		return 0;
	}

	// Rounding second?
	const secondsString = parts.pop() ?? "0";
	const seconds = parseInt(secondsString, 10);

	// Minutes
	const minutesString = parts.pop() ?? "0";
	const minutes = parseInt(minutesString, 10);

	// Hours
	const hoursString = parts.pop() ?? "0";
	const hours = parseInt(hoursString, 10);

	return minutes + hours * 60 + (seconds >= 30 ? 1 : 0);
}
