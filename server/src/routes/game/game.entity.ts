import type { Game, GameOrigin, GamePlay } from "@personal-tracker/shared/game";

import { randomUUID } from "crypto";

export interface PlayMongo {
	id: string;
	date: string;
	duration?: number;
	comment?: string;
	created?: string;
	origin?: GameOrigin;
	auto?: boolean;
}

export interface GameMongo {
	id: string;
	name: string;
	developper: string;
	editor: string;
	complete?: boolean;
	comment?: string;
	links?: Array<{ name: string; link: string }>;
	storeIds?: Game["storeIds"];
	capsule?: string;
	header?: string;
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
	if (game.storeIds) {
		const storeIds = Object.fromEntries(Object.entries(game.storeIds).filter(([, id]) => id));
		if (Object.keys(storeIds).length > 0) {
			game.storeIds = storeIds;
		} else {
			delete game.storeIds;
		}
	}
	return game;
}

// A play saved by hand is a manual play: an auto (synced) play the user edits stops being replaced by the sync
export function toManualPlay<T extends { auto?: boolean }>(play: T): T {
	return play.auto ? { ...play, auto: false } : play;
}

export function sortPlaysDesc(a: PlayMongo, b: PlayMongo) {
	if (b.date === a.date) {
		return (b.created ?? "").localeCompare(a.created ?? "");
	}
	return b.date.localeCompare(a.date);
}
