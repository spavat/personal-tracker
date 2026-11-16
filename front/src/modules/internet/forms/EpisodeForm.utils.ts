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
	};
}

export const onSubmitEpisode = (data: EpisodeInputs) => {
	const { tags, contextTags, ignoredTags, durationReal, created, ...othersProps } = data.episode;
	return {
		...othersProps,
		...(durationReal ? { durationReal } : {}),
		tags: (tags ?? []).map((t) => t.value),
		contextTags: (contextTags ?? []).map((t) => t.value),
		ignoredTags: (ignoredTags ?? []).map((t) => t.value),
		...(created && created !== "" ? { created } : {}),
	};
};
