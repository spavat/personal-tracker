import type { LifespanCategory } from "@personal-tracker/shared/lifespan";

import { randomUUID } from "crypto";

export type { LifespanCategory };

// True when parentId is the category itself or one of its descendants: saving it would make a loop
export function isOwnDescendant(
	id: string,
	parentId: string,
	categories: Array<Pick<LifespanCategory, "id" | "parentId">>,
) {
	const parentById = new Map(categories.map((category) => [category.id, category.parentId]));
	const seen = new Set<string>();
	for (
		let current: string | null | undefined = parentId;
		current && !seen.has(current);
		current = parentById.get(current)
	) {
		if (current === id) return true;
		seen.add(current);
	}
	return false;
}

export function buildLifespanCategory(input: Omit<LifespanCategory, "id">): LifespanCategory {
	return { id: randomUUID(), ...input };
}
