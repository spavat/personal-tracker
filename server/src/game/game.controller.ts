import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import {
	DetailsGameParamsRequestSchema,
	GameDeleteParamsRequestSchema,
	type GameDeleteParamsRequestType,
	GameListQuerystringRequestSchema,
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

	@Post("save")
	@HttpCode(200)
	save(@Body({ schema: GameSaveBodyRequestSchema }) body: GameSaveBodyRequestType) {
		return this.service.save(body);
	}

	@Delete("games/:gameId/plays/:playId")
	deletePlay(@Param({ schema: GameDeleteParamsRequestSchema }) { gameId, playId }: GameDeleteParamsRequestType) {
		return this.service.deletePlay(gameId, playId);
	}
}
