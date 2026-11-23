import { randomUUID } from "node:crypto";

// An episode as the API answers it: one view (id, date, durationReal, contextTags, comment, created) with the fields
// of its episode (the release). The view/episode split reaches the API in ticket 04b.
export interface EpisodeDoc {
	id: string;
	name: string;
	shortName?: string;
	duration: number;
	durationReal?: number;
	date: string;
	type: string;
	link?: string;
	tags?: Array<string>;
	contextTags?: Array<string>;
	ignoredTags?: Array<string>;
	created?: string;
	comment?: string;
	externalId?: string;
}

// A program as the API answers it: `author` and `network` are its credits joined with " && "
export interface ProgramDoc {
	id: string;
	name: string;
	shortName?: string;
	author?: string;
	country?: string;
	network?: string;
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

export function buildEpisode(input: any) {
	return {
		...input,
		id: randomUUID(),
		...(!input.created ? { created: Temporal.Now.plainDateTimeISO().toString() } : {}),
	};
}

export function cleanEpisode(episode: any) {
	if (!episode.tags || episode.tags.length === 0) {
		delete episode.tags;
	}
	if (!episode.contextTags || episode.contextTags.length === 0) {
		delete episode.contextTags;
	}
	if (!episode.ignoredTags || episode.ignoredTags.length === 0) {
		delete episode.ignoredTags;
	}
	if (!episode.links || episode.links.length === 0) {
		delete episode.links;
	}
	return episode;
}

// Tags of an episode: the program tags it does not ignore, plus its own (each once)
export function getEpisodeTags(
	programTags: Array<string> | undefined,
	episode: Pick<EpisodeDoc, "tags" | "ignoredTags">,
): Array<string> {
	const ignored = episode.ignoredTags ?? [];
	return [...new Set([...(programTags ?? []).filter((tag) => !ignored.includes(tag)), ...(episode.tags ?? [])])];
}

export function sortEpisodesDesc(a: EpisodeDoc, b: EpisodeDoc) {
	if (b.date === a.date) {
		return (b.created ?? "").localeCompare(a.created ?? "");
	}
	return b.date.localeCompare(a.date);
}

export function getDetails(program: any) {
	const { episodes, totalDuration, totalDurationReal, lastSeenDate } = program.episodes.reduce(
		(acc: any, episode: any, index: number) => {
			acc.episodes++;
			acc.totalDuration += episode.duration;
			acc.totalDurationReal += episode.durationReal ? episode.durationReal : episode.duration;
			if (index === 0) {
				acc.lastSeenDate = episode.date;
			}
			return acc;
		},
		{
			episodes: 0,
			totalDuration: 0,
			totalDurationReal: 0,
			lastSeenDate: "",
		},
	);
	return {
		episodes: episodes,
		averageLength: episodes > 0 ? Math.round(totalDuration / episodes) : 0,
		completionRate: episodes > 0 ? Math.round((totalDurationReal / totalDuration) * 100) : 0,
		lastSeenDate: lastSeenDate,
	};
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
