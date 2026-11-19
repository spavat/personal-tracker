import type {
	GameDeleteParamsRequestType,
	GamePlay,
	GameSaveBodyRequestType,
	GameListQuerystringRequestSchema,
	PlayListQuerystringRequestSchema,
} from "@personal-tracker/shared/game";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";

import { randomUUID } from "crypto";

import type { GameRepository } from "./game.repository";

import { buildPlay, cleanGame, sortPlaysDesc, toManualPlay } from "./game.entity";
import { GAME_IMAGE_FIELDS, type GameImageField, type GameImageStorageRepository } from "./image-storage.repository";

type GameImages = Pick<GameImageStorageRepository, "isOwnUrl" | "uploadFromSource" | "resolveImages">;

type GameListQuery = z.infer<typeof GameListQuerystringRequestSchema>;
type PlayListQuery = z.infer<typeof PlayListQuerystringRequestSchema>;

export class ListGamesUseCase {
	constructor(
		private repo: GameRepository,
		private images: GameImages,
	) {}

	async execute({ sort, search }: GameListQuery, log: FastifyBaseLogger) {
		log.info("ListGamesUseCase.execute");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		const games = await this.repo.findAll({ search: search ?? "", sortField, sortDirection });
		return games?.map((game: any) => this.images.resolveImages(game));
	}
}

export class ListPlaysUseCase {
	constructor(
		private repo: GameRepository,
		private images: GameImages,
	) {}

	async execute({ from, to }: PlayListQuery, log: FastifyBaseLogger) {
		log.info("ListPlaysUseCase.execute");
		const games = await this.repo.findPlaysInRange({ from, to });
		return games?.map((game: any) => this.images.resolveImages(game));
	}
}

export class SaveGameUseCase {
	constructor(
		private repo: GameRepository,
		private images: GameImages,
	) {}

	async execute({ game, play, gameId }: GameSaveBodyRequestType, log: FastifyBaseLogger) {
		log.info("SaveGameUseCase.execute");
		if (gameId && game?.id) {
			throw new Error("Cannot provide both gameId and game.id");
		}

		if (game) {
			if (game.id) {
				// Update existing game
				const current = await this.repo.findById(game.id);
				return this.repo.update(game.id, cleanGame(await this.uploadPictures(game.id, game, current)));
			}
			// Add new game
			const id = randomUUID();
			return this.repo.insert({
				id,
				...cleanGame(await this.uploadPictures(id, game)),
				plays: play ? [buildPlay(play)] : [],
			});
		}

		if (play && gameId) {
			if (play.id) {
				// Update existing play
				return this.repo.updatePlay(gameId, toManualPlay(play as GamePlay));
			}
			// Add new play to existing game
			return this.repo.pushPlay(gameId, buildPlay(play));
		}

		return { error: "Nothing to do" };
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

export class DeletePlayUseCase {
	constructor(private repo: GameRepository) {}

	execute({ playId, gameId }: GameDeleteParamsRequestType, log: FastifyBaseLogger) {
		log.info("DeletePlayUseCase.execute");
		if (!playId || !gameId) {
			throw new Error("Both playId and gameId are required");
		}
		return this.repo.deletePlay(gameId, playId);
	}
}

export class GetGameUseCase {
	constructor(
		private repo: GameRepository,
		private images: GameImages,
	) {}

	async execute(id: string, log: FastifyBaseLogger) {
		log.info("GetGameUseCase.execute");
		const res = await this.repo.findById(id);
		if (!res) return null;
		const { _id, plays, ...rest } = res;
		return {
			...this.images.resolveImages(rest),
			plays: plays?.toSorted(sortPlaysDesc) ?? [],
		};
	}
}
