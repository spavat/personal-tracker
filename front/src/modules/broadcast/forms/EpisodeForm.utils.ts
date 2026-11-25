import { type CreditInput, type CreditRole, toSaveCredits } from "./CreditRows";

interface Item {
	value: string;
}
export interface EpisodeInputs {
	episode: {
		name: string;
		duration: number;
		durationReal?: number;
		date: string;
		type: string;
		link: string;
		tags: Array<Item>;
		contextTags: Array<Item>;
		ignoredTags: Array<Item>;
		externalId?: string;
		comment?: string;
		created?: string;
		credits?: Array<CreditInput>;
		numberLabel?: string;
		position?: number;
		releaseDate?: string;
		seasonId?: string;
		formatId?: string;
		description?: string;
		// the proxy URL of the stored cover, an outside URL or a data URI
		cover?: string;
	};
}

export const onSubmitEpisode = (data: EpisodeInputs) => {
	const { tags, contextTags, ignoredTags, durationReal, created, credits, ...othersProps } = data.episode;
	return {
		...othersProps,
		...(durationReal ? { durationReal } : {}),
		tags: (tags ?? []).map((t) => t.value),
		contextTags: (contextTags ?? []).map((t) => t.value),
		ignoredTags: (ignoredTags ?? []).map((t) => t.value),
		credits: toSaveCredits(credits),
		...(created && created !== "" ? { created } : {}),
	};
};

export const EPISODE_CREDIT_ROLES: Array<CreditRole> = [
	{ value: "guest", label: "Invité·e", kind: "person" },
	{ value: "interviewee", label: "Interviewé·e", kind: "person" },
	{ value: "host", label: "Animation", kind: "person" },
];
