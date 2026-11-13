import type { GameOrigin, GameStore } from "@personal-tracker/shared/game";
import type { FastifyInstance } from "fastify";

import type { GameMongo, PlayMongo } from "./game.entity";

import { accentInsensitiveRegex } from "../../mongo-search";

interface GameListFilters {
	search: string;
	sortField: string;
	sortDirection: string;
}

const CLEARABLE_GAME_FIELDS = ["links", "storeIds"];

export class GameRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get collection() {
		return this.mongo?.db?.collection<GameMongo>("game");
	}

	findAll({ search, sortField, sortDirection }: GameListFilters) {
		const cursor = this.collection?.aggregate([
			{
				$match: {
					$or: [{ name: accentInsensitiveRegex(search) }, { developper: accentInsensitiveRegex(search) }],
				},
			},
			{
				$addFields: {
					playCount: { $size: "$plays" },
					latestPlayDate: {
						$max: {
							$ifNull: ["$plays.date", []],
						},
					},
					latestCreatedDate: {
						$max: {
							$ifNull: ["$plays.created", []],
						},
					},
				},
			},
			{
				$project: {
					_id: 0,
					plays: 0,
				},
			},
			{
				$sort: {
					[sortField]: sortDirection === "asc" ? 1 : -1,
					latestCreatedDate: -1,
				},
			},
		]);
		return cursor?.toArray();
	}

	findPlaysInRange({ from, to }: { from?: string; to?: string } = {}) {
		const cursor = this.collection?.aggregate([
			{
				$match: {
					plays: {
						$elemMatch: {
							date: {
								$gte: from,
								$lte: to,
							},
						},
					},
				},
			},
			{
				$set: {
					plays: {
						$filter: {
							input: "$plays",
							as: "play",
							cond: {
								$and: [{ $gte: ["$$play.date", from] }, { $lte: ["$$play.date", to] }],
							},
						},
					},
				},
			},
			{
				$set: {
					latestPlayDate: {
						$max: {
							$ifNull: ["$plays.date", []],
						},
					},
					latestCreatedDate: {
						$max: {
							$ifNull: ["$plays.created", []],
						},
					},
				},
			},
			{
				$sort: {
					latestPlayDate: -1,
					latestCreatedDate: -1,
				},
			},
			{
				$project: {
					_id: 0,
				},
			},
		]);
		return cursor?.toArray();
	}

	findById(id: string) {
		return this.collection?.findOne({ id });
	}

	insert(game: Record<string, unknown>) {
		return this.collection?.insertOne(game as any);
	}

	update(id: string, game: Record<string, unknown>) {
		// Lists left out when empty (see cleanGame): removed from the game
		const unsetFields = Object.fromEntries(
			CLEARABLE_GAME_FIELDS.filter((key) => !(key in game)).map((key) => [key, "" as const]),
		);
		return this.collection?.updateOne(
			{ id },
			{ $set: game, ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}) },
			{ upsert: false },
		);
	}

	pushPlay(gameId: string, play: Record<string, unknown>) {
		return this.collection?.updateOne({ id: gameId }, { $push: { plays: play } } as any);
	}

	updatePlay(gameId: string, play: Record<string, unknown> & { id: string }) {
		const setFields = Object.fromEntries(
			Object.entries(play).map(([key, value]) => [`plays.$[element].${key}`, value]),
		);
		return this.collection?.updateOne(
			{ id: gameId },
			{ $set: setFields },
			{ arrayFilters: [{ "element.id": play.id }] },
		);
	}

	deletePlay(gameId: string, playId: string) {
		return this.collection?.updateOne({ id: gameId }, { $pull: { plays: { id: playId } } } as any);
	}

	// --- store sync ---

	/** Every game with what matching and catch-up need: names, store ids and plays. */
	async findAllForSync(): Promise<Array<Pick<GameMongo, "id" | "name" | "storeIds" | "plays">>> {
		return (
			(await this.collection
				?.find({}, { projection: { _id: 0, id: 1, name: 1, storeIds: 1, plays: 1 } })
				.toArray()) ?? []
		);
	}

	setStoreId(gameId: string, store: GameStore, storeGameId: string) {
		return this.collection?.updateOne({ id: gameId }, { $set: { [`storeIds.${store}`]: storeGameId } });
	}

	/** Adds the play's minutes to the game's auto play of that day and origin, or adds the play when there is none. */
	async addToAutoPlay(gameId: string, play: AutoPlayMongo) {
		const result = await this.collection?.updateOne(
			{ id: gameId, plays: { $elemMatch: { date: play.date, origin: play.origin, auto: true } } },
			{ $inc: { "plays.$.duration": play.duration } },
		);
		if (!result?.matchedCount) {
			await this.pushPlay(gameId, { ...play });
		}
	}

	/** Puts the play in place of the game's auto play of that day and origin (a catch-up is replaced, not added to). */
	async replaceAutoPlay(gameId: string, play: AutoPlayMongo) {
		await this.collection?.updateOne({ id: gameId }, {
			$pull: { plays: { date: play.date, origin: play.origin, auto: true } },
		} as any);
		await this.pushPlay(gameId, { ...play });
	}

	/** Removes the auto plays of a day for these origins, on every game (replay). */
	deleteAutoPlays(date: string, origins: GameOrigin[]) {
		return this.collection?.updateMany({}, {
			$pull: { plays: { date, origin: { $in: origins }, auto: true } },
		} as any);
	}

	/** Overwrites the merged fields of the kept game (merge of two duplicates). */
	mergeInto(gameId: string, fields: Pick<GameMongo, "plays"> & Partial<GameMongo>) {
		return this.collection?.updateOne({ id: gameId }, { $set: fields });
	}

	deleteGame(id: string) {
		return this.collection?.deleteOne({ id });
	}
}

export type AutoPlayMongo = PlayMongo & { origin: GameOrigin; duration: number; auto: true };
