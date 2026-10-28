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

import { buildPlay, cleanGame, sortPlaysDesc } from "./game.entity";

type GameListQuery = z.infer<typeof GameListQuerystringRequestSchema>;
type PlayListQuery = z.infer<typeof PlayListQuerystringRequestSchema>;

export class ListGamesUseCase {
	constructor(private repo: GameRepository) {}

	execute({ sort, search }: GameListQuery, log: FastifyBaseLogger) {
		log.info("ListGamesUseCase.execute");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		return this.repo.findAll({ search: search ?? "", sortField, sortDirection });
	}
}

export class ListPlaysUseCase {
	constructor(private repo: GameRepository) {}

	execute({ from, to }: PlayListQuery, log: FastifyBaseLogger) {
		log.info("ListPlaysUseCase.execute");
		return this.repo.findPlaysInRange({ from, to });
	}
}

export class SaveGameUseCase {
	constructor(private repo: GameRepository) {}

	execute({ game, play, gameId }: GameSaveBodyRequestType, log: FastifyBaseLogger) {
		log.info("SaveGameUseCase.execute");
		if (gameId && game?.id) {
			throw new Error("Cannot provide both gameId and game.id");
		}

		if (game) {
			if (game.id) {
				// Update existing game
				return this.repo.update(game.id, cleanGame(game));
			}
			// Add new game
			return this.repo.insert({
				id: randomUUID(),
				...cleanGame(game),
				plays: play ? [buildPlay(play)] : [],
			});
		}

		if (play && gameId) {
			if (play.id) {
				// Update existing play
				return this.repo.updatePlay(gameId, play as GamePlay);
			}
			// Add new play to existing game
			return this.repo.pushPlay(gameId, buildPlay(play));
		}

		return { error: "Nothing to do" };
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
	constructor(private repo: GameRepository) {}

	async execute(id: string, log: FastifyBaseLogger) {
		log.info("GetGameUseCase.execute");
		const res = await this.repo.findById(id);
		if (!res) return null;
		const { _id, plays, ...rest } = res;
		return {
			...rest,
			plays: plays?.toSorted(sortPlaysDesc) ?? [],
		};
	}
}
