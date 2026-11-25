import type { EntityDirectoryItem } from "@personal-tracker/shared/entity";

import type { EntityFields } from "../entities.repository.js";

import { toEntityView } from "../entity.entity.js";

// The ids of the works an entity is credited on in one role
type RoleIds<R extends string> = { entityId: string | null; role: R; ids: string[] };

const BOOK_ROLES = ["author", "illustrator", "preface", "translator", "publisher"] as const;
const PROGRAM_ROLES = ["host", "producer", "network"] as const;
const EPISODE_ROLES = ["host", "guest", "interviewee"] as const;

// Per entity: its distinct works over all its roles (`total`), and its works in each role (0 without it)
export function countByRole<R extends string>(rows: RoleIds<R>[], roles: readonly R[]) {
	const byEntity = new Map<string, { all: Set<string>; roles: Map<R, number> }>();
	for (const { entityId, role, ids } of rows) {
		if (!entityId) continue;
		const entry = byEntity.get(entityId) ?? { all: new Set<string>(), roles: new Map<R, number>() };
		ids.forEach((id) => entry.all.add(id));
		entry.roles.set(role, (entry.roles.get(role) ?? 0) + ids.length);
		byEntity.set(entityId, entry);
	}
	return new Map(
		[...byEntity].map(([entityId, entry]) => [
			entityId,
			{
				total: entry.all.size,
				...(Object.fromEntries(roles.map((role) => [role, entry.roles.get(role) ?? 0])) as Record<R, number>),
			},
		]),
	);
}

// as each module reads them
export type Credits = {
	show: Map<string, { spectacles: number; performances: number }>;
	books: RoleIds<(typeof BOOK_ROLES)[number]>[];
	programs: RoleIds<(typeof PROGRAM_ROLES)[number]>[];
	episodes: RoleIds<(typeof EPISODE_ROLES)[number]>[];
};

// The entities (in their order) with their credits counted module by module and role by role
export function toDirectoryItems(entities: EntityFields[], credits: Credits): EntityDirectoryItem[] {
	const books = countByRole(credits.books, BOOK_ROLES);
	const programs = countByRole(credits.programs, PROGRAM_ROLES);
	const episodes = countByRole(credits.episodes, EPISODE_ROLES);
	const none = <R extends string>(roles: readonly R[]) =>
		({ total: 0, ...Object.fromEntries(roles.map((role) => [role, 0])) }) as { total: number } & Record<R, number>;
	return entities.map((entity) => {
		const { total: nbBooks, ...bookRoles } = books.get(entity.id) ?? none(BOOK_ROLES);
		const { total: nbPrograms, ...programRoles } = programs.get(entity.id) ?? none(PROGRAM_ROLES);
		const { total: nbEpisodes, ...episodeRoles } = episodes.get(entity.id) ?? none(EPISODE_ROLES);
		return {
			...toEntityView(entity),
			book: { books: nbBooks, ...bookRoles },
			show: credits.show.get(entity.id) ?? { spectacles: 0, performances: 0 },
			program: { programs: nbPrograms, ...programRoles },
			episode: { episodes: nbEpisodes, ...episodeRoles },
		};
	});
}

// the sortable counts
const COUNTS: Record<string, (item: EntityDirectoryItem) => number> = {
	books: (item) => item.book.books,
	spectacles: (item) => item.show.spectacles,
	performances: (item) => item.show.performances,
	programs: (item) => item.program.programs,
	episodes: (item) => item.episode.episodes,
};

// Credited in at least one module (a visitor only sees these)
export function hasCredits(item: EntityDirectoryItem) {
	return Object.values(COUNTS).some((count) => count(item) > 0);
}

// The items come sorted by name (sort name first): a count sort keeps that order between equal counts, an unknown
// field sorts by name
export function sortDirectory(items: EntityDirectoryItem[], sortField: string, sortDirection: string) {
	const direction = sortDirection === "desc" ? -1 : 1;
	const count = COUNTS[sortField];
	if (!count) {
		return direction === 1 ? items : items.toReversed();
	}
	return items.toSorted((a, b) => direction * (count(a) - count(b)));
}
