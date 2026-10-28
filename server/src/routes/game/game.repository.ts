import type { FastifyInstance } from "fastify";

import type { GameMongo } from "./game.entity";

interface GameListFilters {
	search: string;
	sortField: string;
	sortDirection: string;
}

const CLEARABLE_GAME_FIELDS = ["links"];

export class GameRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get collection() {
		return this.mongo?.db?.collection<GameMongo>("game");
	}

	findAll({ search, sortField, sortDirection }: GameListFilters) {
		const cursor = this.collection?.aggregate([
			{
				$match: {
					$or: [
						{ name: new RegExp(`${search.normalize("NFC")}`, "i") },
						{ developper: new RegExp(`${search.normalize("NFC")}`, "i") },
					],
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
}
