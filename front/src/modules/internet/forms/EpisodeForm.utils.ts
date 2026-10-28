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
		externalId?: string;
		comment?: string;
		created?: string;
	};
}

export const onSubmitEpisode = (data: EpisodeInputs) => {
	const { tags, contextTags, durationReal, created, ...othersProps } = data.episode;
	return {
		...othersProps,
		...(durationReal ? { durationReal } : {}),
		tags: (tags ?? []).map((t) => t.value),
		contextTags: (contextTags ?? []).map((t) => t.value),
		...(created && created !== "" ? { created } : {}),
	};
};
