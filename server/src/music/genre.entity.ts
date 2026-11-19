import type { MusicGenre } from "@personal-tracker/shared/music";

import { randomUUID } from "node:crypto";

export function buildGenre(input: Omit<MusicGenre, "id">): MusicGenre {
	return { id: randomUUID(), ...input };
}

// sub-genre -> name of the main genre grouping it
export function mapSubGenres(groups: MusicGenre[]): Record<string, string> {
	const map: Record<string, string> = {};
	for (const mainGenre of groups) {
		for (const genre of mainGenre.genres) {
			map[genre] = mainGenre.name;
		}
	}
	return map;
}
