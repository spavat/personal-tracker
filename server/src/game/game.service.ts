import type {
	GameListQuerystringRequestSchema,
	GamePlay,
	GameSaveBodyRequestType,
	PlayListQuerystringRequestSchema,
} from "@personal-tracker/shared/game";
import type { z } from "zod";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { NotFoundError } from "../common/errors.js";
import { GAME_IMAGE_FIELDS, type GameImageField, GameImagesStorage } from "./game-images.storage.js";
import { buildPlay, cleanGame, sortPlaysDesc, toManualPlay } from "./game.entity.js";
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
		const game = await this.repo.findById(id);
		if (!game) {
			throw new NotFoundError("Jeu introuvable");
		}
		const { _id, plays, ...rest } = game;
		return { ...this.images.resolveImages(rest), plays: plays?.toSorted(sortPlaysDesc) ?? [] };
	}

	// The body schema's refine guarantees either a game (with an optional first play), or a play with its gameId
	async save({ game, play, gameId }: GameSaveBodyRequestType) {
		this.logger.log("save");
		if (game) {
			if (game.id) {
				const current = await this.repo.findById(game.id);
				return this.repo.update(game.id, cleanGame(await this.uploadPictures(game.id, game, current)));
			}
			const id = randomUUID();
			return this.repo.insert({
				id,
				...cleanGame(await this.uploadPictures(id, game)),
				plays: play ? [buildPlay(play)] : [],
			});
		}

		if (play?.id) {
			// a play edited by hand stops being replaced by the store sync
			return this.repo.updatePlay(gameId!, toManualPlay(play as GamePlay));
		}
		return this.repo.pushPlay(gameId!, buildPlay(play!));
	}

	deletePlay(gameId: string, playId: string) {
		this.logger.log("deletePlay");
		return this.repo.deletePlay(gameId, playId);
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
