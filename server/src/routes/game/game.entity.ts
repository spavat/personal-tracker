import type { GamePlay } from "@personal-tracker/shared/game";

import { randomUUID } from "crypto";

export interface PlayMongo {
	id: string;
	date: string;
	duration?: number;
	comment?: string;
	created?: string;
}

export interface GameMongo {
	id: string;
	name: string;
	developper: string;
	editor: string;
	complete?: boolean;
	comment?: string;
	links?: Array<{ name: string; link: string }>;
	plays: Array<PlayMongo>;
}

export function buildPlay(input: Partial<GamePlay>): GamePlay {
	return {
		...input,
		id: randomUUID(),
		created: Temporal.Now.plainDateTimeISO().toString(),
	} as GamePlay;
}

export function cleanGame(game: any) {
	if (!game.links || game.links.length === 0) {
		delete game.links;
	}
	return game;
}

export function sortPlaysDesc(a: PlayMongo, b: PlayMongo) {
	if (b.date === a.date) {
		return (b.created ?? "").localeCompare(a.created ?? "");
	}
	return b.date.localeCompare(a.date);
}
