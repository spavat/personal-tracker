import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import {
	DetailsGameParamsRequestSchema,
	GameDeleteParamsRequestSchema,
	type GameDeleteParamsRequestType,
	GameListQuerystringRequestSchema,
	GameParamsRequestSchema,
	GamePlayParamsRequestSchema,
	GamePlaySaveBodyRequestSchema,
	type GamePlaySaveBodyRequestType,
	GameSaveBodyRequestSchema,
	type GameSaveBodyRequestType,
	PlayListQuerystringRequestSchema,
} from "@personal-tracker/shared/game";

import { Public } from "../auth/public.decorator.js";
import { type GameListQuery, GameService, type PlayListQuery } from "./game.service.js";

// Mounted at /game by GameModule's RouterModule path
@Controller()
export class GameController {
	constructor(private readonly service: GameService) {}

	@Get("games")
	@Public()
	listGames(@Query({ schema: GameListQuerystringRequestSchema }) query: GameListQuery) {
		return this.service.listGames(query);
	}

	@Get("plays")
	@Public()
	listPlays(@Query({ schema: PlayListQuerystringRequestSchema }) query: PlayListQuery) {
		return this.service.listPlays(query);
	}

	@Get("games/:id")
	@Public()
	getGame(@Param({ schema: DetailsGameParamsRequestSchema }) { id }: { id: string }) {
		return this.service.getGame(id);
	}

	// the game, with an optional first play
	@Post("games")
	create(@Body({ schema: GameSaveBodyRequestSchema }) body: GameSaveBodyRequestType) {
		return this.service.create(body);
	}

	@Put("games/:id")
	update(
		@Param({ schema: GameParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: GameSaveBodyRequestSchema }) body: GameSaveBodyRequestType,
	) {
		return this.service.update(id, body);
	}

	@Post("games/:gameId/plays")
	createPlay(
		@Param({ schema: GamePlayParamsRequestSchema }) { gameId }: { gameId: string },
		@Body({ schema: GamePlaySaveBodyRequestSchema }) play: GamePlaySaveBodyRequestType,
	) {
		return this.service.createPlay(gameId, play);
	}

	@Put("games/:gameId/plays/:playId")
	updatePlay(
		@Param({ schema: GameDeleteParamsRequestSchema }) { gameId, playId }: GameDeleteParamsRequestType,
		@Body({ schema: GamePlaySaveBodyRequestSchema }) play: GamePlaySaveBodyRequestType,
	) {
		return this.service.updatePlay(gameId, playId, play);
	}

	@Delete("games/:gameId/plays/:playId")
	@HttpCode(204)
	async deletePlay(
		@Param({ schema: GameDeleteParamsRequestSchema }) { gameId, playId }: GameDeleteParamsRequestType,
	) {
		await this.service.deletePlay(gameId, playId);
	}
}
