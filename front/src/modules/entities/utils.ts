import type { EntityDirectoryItem } from "@personal-tracker/shared/entity";

const CREDIT_COUNTS = [
	{ field: "books", icon: "fa-book", one: "livre", many: "livres", count: (e: EntityDirectoryItem) => e.book.books },
	{
		field: "spectacles",
		icon: "fa-masks-theater",
		one: "spectacle",
		many: "spectacles",
		count: (e: EntityDirectoryItem) => e.show.spectacles,
	},
	{
		field: "performances",
		icon: "fa-square-poll-vertical",
		one: "représentation",
		many: "représentations",
		count: (e: EntityDirectoryItem) => e.show.performances,
	},
	{
		field: "programs",
		icon: "fa-microphone",
		one: "émission",
		many: "émissions",
		count: (e: EntityDirectoryItem) => e.program.programs,
	},
	{
		field: "episodes",
		icon: "fa-comments",
		one: "épisode",
		many: "épisodes",
		count: (e: EntityDirectoryItem) => e.episode.episodes,
	},
] as const;

// What the entity is credited for, module by module: only the counts above 0
export function creditCounts(entity: EntityDirectoryItem) {
	return CREDIT_COUNTS.flatMap(({ field, icon, one, many, count }) => {
		const value = count(entity);
		return value > 0 ? [{ field, icon, count: value, label: value > 1 ? many : one }] : [];
	});
}

type RoleFilter = { value: string; label: string; test: (entity: EntityDirectoryItem) => boolean };

// The roles of the list's filter by module, each with the entities it keeps
export const ROLE_FILTER_GROUPS: Array<{ label: string; roles: RoleFilter[] }> = [
	{
		label: "Livre",
		roles: [
			{ value: "author", label: "Auteur·ice", test: (e) => e.book.author > 0 },
			{ value: "illustrator", label: "Illustration", test: (e) => e.book.illustrator > 0 },
			{ value: "preface", label: "Préface", test: (e) => e.book.preface > 0 },
			{ value: "translator", label: "Traduction", test: (e) => e.book.translator > 0 },
			{ value: "publisher", label: "Éditeur", test: (e) => e.book.publisher > 0 },
		],
	},
	{
		label: "Spectacle",
		// a performance or a cast model
		roles: [{ value: "artist", label: "Artiste", test: (e) => e.show.spectacles > 0 }],
	},
	{
		label: "Émissions",
		roles: [
			// of a program or of an episode
			{ value: "host", label: "Animation", test: (e) => e.program.host > 0 || e.episode.host > 0 },
			{ value: "producer", label: "Production", test: (e) => e.program.producer > 0 },
			{ value: "network", label: "Réseau", test: (e) => e.program.network > 0 },
			{ value: "guest", label: "Invité·e", test: (e) => e.episode.guest > 0 },
			{ value: "interviewee", label: "Interviewé·e", test: (e) => e.episode.interviewee > 0 },
		],
	},
];
