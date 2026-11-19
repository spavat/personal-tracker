import type { GameOrigin, GameStore } from "@personal-tracker/shared/game";

import { Inject, Injectable } from "@nestjs/common";
import { Db, UpdateFilter } from "mongodb";

import type { GameMongo, PlayMongo } from "./game.entity.js";

import { MONGO_DB } from "../database/database.tokens.js";
import { accentInsensitiveRegex } from "../database/mongo-search.query.js";

interface GameListFilters {
	search: string;
	sortField: string;
	sortDirection: string;
	limit?: number;
	// keep the plays (catch-ups excluded, like findPlaysInRange)
	withPlays?: boolean;
}

// what findAll computes from the plays
type GameOverviewMongo = GameMongo & {
	playCount: number;
	totalDuration: number;
	latestPlayDate?: string;
	latestCreatedDate?: string;
	latestRealPlayDate?: string;
};

const CLEARABLE_GAME_FIELDS = ["links", "storeIds", "capsule", "header"];

@Injectable()
export class GameRepository {
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	private get collection() {
		return this.db.collection<GameMongo>("game");
	}

	findAll({ search, sortField, sortDirection, limit, withPlays = false }: GameListFilters) {
		const cursor = this.collection.aggregate<GameOverviewMongo>([
			{
				$match: {
					$or: [{ name: accentInsensitiveRegex(search) }, { developper: accentInsensitiveRegex(search) }],
				},
			},
			{
				$addFields: {
					playCount: { $size: "$plays" },
					totalDuration: { $sum: "$plays.duration" },
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
					// a catch-up is a lifetime total, not that day's play: it doesn't count as played
					latestRealPlayDate: {
						$max: {
							$map: {
								input: {
									$filter: {
										input: { $ifNull: ["$plays", []] },
										cond: { $eq: [{ $type: "$$this.catchUp" }, "missing"] },
									},
								},
								in: "$$this.date",
							},
						},
					},
				},
			},
			{
				$project: {
					_id: 0,
					...(!withPlays && { plays: 0 }),
				},
			},
			{
				$sort: {
					[sortField]: sortDirection === "asc" ? 1 : -1,
					latestCreatedDate: -1,
				},
			},
			...(limit ? [{ $limit: limit }] : []),
			...(withPlays
				? [
						{
							$set: {
								plays: {
									$filter: {
										input: "$plays",
										as: "play",
										cond: { $eq: [{ $type: "$$play.catchUp" }, "missing"] },
									},
								},
							},
						},
					]
				: []),
		]);
		return cursor.toArray();
	}

	findPlaysInRange({ from, to }: { from?: string; to?: string } = {}) {
		const cursor = this.collection.aggregate<GameMongo>([
			{
				$match: {
					plays: {
						$elemMatch: {
							date: {
								$gte: from,
								$lte: to,
							},
							// a catch-up is a lifetime total, not that day's play: it only dates the game
							catchUp: { $exists: false },
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
								$and: [
									{ $gte: ["$$play.date", from] },
									{ $lte: ["$$play.date", to] },
									{ $eq: [{ $type: "$$play.catchUp" }, "missing"] },
								],
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
		return cursor.toArray();
	}

	findById(id: string) {
		return this.collection.findOne({ id });
	}

	insert(game: GameMongo) {
		return this.collection.insertOne(game);
	}

	update(id: string, game: Partial<GameMongo>) {
		// Lists left out when empty (see cleanGame): removed from the game
		const unsetFields = Object.fromEntries(
			CLEARABLE_GAME_FIELDS.filter((key) => !(key in game)).map((key) => [key, "" as const]),
		);
		const update: UpdateFilter<GameMongo> = { $set: game };
		if (Object.keys(unsetFields).length > 0) update.$unset = unsetFields;
		return this.collection.updateOne({ id }, update, { upsert: false });
	}

	pushPlay(gameId: string, play: PlayMongo) {
		return this.collection.updateOne({ id: gameId }, { $push: { plays: play } });
	}

	updatePlay(gameId: string, play: Partial<PlayMongo> & { id: string }) {
		const setFields = Object.fromEntries(
			Object.entries(play).map(([key, value]) => [`plays.$[element].${key}`, value]),
		);
		return this.collection.updateOne(
			{ id: gameId },
			{ $set: setFields },
			{ arrayFilters: [{ "element.id": play.id }] },
		);
	}

	deletePlay(gameId: string, playId: string) {
		return this.collection.updateOne({ id: gameId }, { $pull: { plays: { id: playId } } });
	}

	// --- store sync ---

	/** Every game with what matching and catch-up need: names, store ids and plays. */
	async findAllForSync(): Promise<
		Array<Pick<GameMongo, "id" | "name" | "storeIds" | "plays" | "capsule" | "header">>
	> {
		return (
			(await this.collection
				.find({}, { projection: { _id: 0, id: 1, name: 1, storeIds: 1, plays: 1, capsule: 1, header: 1 } })
				.toArray()) ?? []
		);
	}

	setStoreId(gameId: string, store: GameStore, storeGameId: string) {
		return this.collection.updateOne({ id: gameId }, { $set: { [`storeIds.${store}`]: storeGameId } });
	}

	/**
	 * Adds the play's minutes to the game's synced play of that day and origin (never to a catch-up), or adds the
	 * play when there is none.
	 */
	async addToAutoPlay(gameId: string, play: AutoPlayMongo) {
		const result = await this.collection.updateOne(
			{
				id: gameId,
				plays: {
					$elemMatch: { date: play.date, origin: play.origin, auto: true, catchUp: { $exists: false } },
				},
			},
			{ $inc: { "plays.$.duration": play.duration } },
		);
		if (!result?.matchedCount) {
			await this.pushPlay(gameId, { ...play });
		}
	}

	/**
	 * Replaces the game's catch-up of that origin (whatever its date) by `play`; without a play, removes it. A
	 * catch-up edited by hand is a manual play: left alone (the new catch-up already subtracts it).
	 */
	async replaceCatchUp(gameId: string, origin: GameOrigin, play?: AutoPlayMongo) {
		await this.collection.updateOne({ id: gameId }, {
			$pull: { plays: { origin, auto: true, catchUp: { $exists: true } } },
		} as any);
		if (play) {
			await this.pushPlay(gameId, { ...play });
		}
	}

	/** Removes the synced plays of a day for these origins, on every game (replay); catch-ups stay. */
	deleteAutoPlays(date: string, origins: GameOrigin[]) {
		return this.collection.updateMany({}, {
			$pull: { plays: { date, origin: { $in: origins }, auto: true, catchUp: { $exists: false } } },
		} as any);
	}

	/** Overwrites the merged fields of the kept game (merge of two duplicates). */
	mergeInto(gameId: string, fields: Pick<GameMongo, "plays"> & Partial<GameMongo>) {
		return this.collection.updateOne({ id: gameId }, { $set: fields });
	}

	/** Sets fields of a game found by the store sync (pictures). */
	updateFields(gameId: string, fields: Partial<GameMongo>) {
		return this.collection.updateOne({ id: gameId }, { $set: fields });
	}

	deleteGame(id: string) {
		return this.collection.deleteOne({ id });
	}
}

export type AutoPlayMongo = PlayMongo & { origin: GameOrigin; duration: number; auto: true };
