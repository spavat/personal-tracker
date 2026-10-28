import { randomUUID } from "crypto";

export interface EpisodeMongo {
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
	created?: string;
	externalId?: string;
}

export interface ProgramMongo {
	id: string;
	name: string;
	shortName?: string;
	author?: string;
	country?: string;
	network?: string;
	links?: Array<string>;
	profile?: string;
	banner?: string;
	episodes: Array<EpisodeMongo>;
	tags?: Array<string>;
	refs?: Record<string, string>;
	description?: string;
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
	if (!episode.links || episode.links.length === 0) {
		delete episode.links;
	}
	return episode;
}

export function sortEpisodesDesc(a: EpisodeMongo, b: EpisodeMongo) {
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
