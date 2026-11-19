import type { MusicGenre } from "@personal-tracker/shared/music";

import { randomUUID } from "crypto";

export type { MusicGenre };

export function buildGenre(input: Omit<MusicGenre, "id">): MusicGenre {
	return { id: randomUUID(), ...input };
}
