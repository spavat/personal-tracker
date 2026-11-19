import type {
	GameListQuerystringRequestSchema,
	GamePlay,
	GamePlaySaveBodyRequestType,
	GameSaveBodyRequestType,
	PlayListQuerystringRequestSchema,
} from "@personal-tracker/shared/game";
import type { z } from "zod";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { NotFoundError } from "../common/errors.js";
import { GAME_IMAGE_FIELDS, type GameImageField, GameImagesStorage } from "./game-images.storage.js";
import { buildPlay, cleanGame, type GameMongo, sortPlaysDesc, toManualPlay } from "./game.entity.js";
import { GameRepository } from "./game.repository.js";

export type GameListQuery = z.infer<typeof GameListQuerystringRequestSchema>;
export type PlayListQuery = z.infer<typeof PlayListQuerystringRequestSchema>;

@Injectable()
export class GameService {
	private readonly logger = new Logger(GameService.name);
	constructor(
		private readonly repo: GameRepository,
		private readonly images: GameImagesStorage,
	) {}

	async listGames({ sort, search }: GameListQuery) {
		this.logger.log("listGames");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		const games = await this.repo.findAll({ search: search ?? "", sortField, sortDirection });
		return games.map((game) => this.images.resolveImages(game));
	}

	async listPlays({ from, to }: PlayListQuery) {
		this.logger.log("listPlays");
		const games = await this.repo.findPlaysInRange({ from, to });
		return games.map((game) => this.images.resolveImages(game));
	}

	async getGame(id: string) {
		this.logger.log("getGame");
		return this.toView((await this.repo.findById(id)) ?? gameNotFound());
	}

	// the game, with an optional first play
	async create({ game: { id: _, ...game }, play }: GameSaveBodyRequestType) {
		this.logger.log("create");
		const id = randomUUID();
		const created = await this.repo.insert({
			id,
			...cleanGame(await this.uploadPictures(id, game)),
			plays: play ? [buildPlay(play)] : [],
		});
		return this.toView(created);
	}

	// the game's fields only: its plays have their own routes
	async update(id: string, { game: { id: _, ...game } }: GameSaveBodyRequestType) {
		this.logger.log("update");
		const current = (await this.repo.findById(id)) ?? gameNotFound();
		const updated = await this.repo.update(id, cleanGame(await this.uploadPictures(id, game, current)));
		return this.toView(updated ?? gameNotFound());
	}

	async createPlay(gameId: string, { id: _, ...fields }: GamePlaySaveBodyRequestType) {
		this.logger.log("createPlay");
		const play = buildPlay(fields);
		if (!(await this.repo.pushPlay(gameId, play))) {
			gameNotFound();
		}
		return play;
	}

	async updatePlay(gameId: string, playId: string, { id: _, ...fields }: GamePlaySaveBodyRequestType) {
		this.logger.log("updatePlay");
		// a play edited by hand stops being replaced by the store sync
		if (!(await this.repo.updatePlay(gameId, toManualPlay({ ...fields, id: playId } as GamePlay)))) {
			playNotFound();
		}
		return (await this.repo.findById(gameId))?.plays.find((p) => p.id === playId) ?? playNotFound();
	}

	async deletePlay(gameId: string, playId: string) {
		this.logger.log("deletePlay");
		if (!(await this.repo.deletePlay(gameId, playId))) {
			playNotFound();
		}
	}

	private toView({ _id, plays, ...game }: GameMongo & { _id?: unknown }) {
		return { ...this.images.resolveImages(game), plays: plays?.toSorted(sortPlaysDesc) ?? [] };
	}

	/**
	 * Pictures given as a URL (or data URI) are stored and replaced by their S3 key; one of our proxy URLs is the
	 * picture already stored. An empty field removes the picture.
	 */
	private async uploadPictures<T extends Partial<Record<GameImageField, string>>>(
		gameId: string,
		game: T,
		current?: Partial<Record<GameImageField, string>> | null,
	): Promise<T> {
		const result: Partial<Record<GameImageField, string>> = { ...game };
		for (const field of GAME_IMAGE_FIELDS) {
			const value = game[field];
			const key = !value
				? undefined
				: this.images.isOwnUrl(value)
					? current?.[field]
					: await this.images.uploadFromSource(gameId, field, value);
			if (key) result[field] = key;
			else delete result[field];
		}
		return result as T;
	}
}

function gameNotFound(): never {
	throw new NotFoundError("game");
}

function playNotFound(): never {
	throw new NotFoundError("play");
}
