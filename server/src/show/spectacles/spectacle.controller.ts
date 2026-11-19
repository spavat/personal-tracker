import type { ServerResponse } from "node:http";
import type { z } from "zod";

import { Body, Controller, Get, Logger, Param, Post, Query, Res, SerializeOptions } from "@nestjs/common";
import {
	SaveSpectacleBodyRequestSchema,
	SpectacleDetailsParamsRequestSchema,
	SpectacleGroupedListRequestSchema,
	SpectacleSchema,
} from "@personal-tracker/shared/show";

import type { SaveSpectacleBody } from "./spectacle.entity.js";

import { Public } from "../../auth/public.decorator.js";
import { toUseCaseLog } from "../../common/use-case-log.js";
import { orNotFound, savedOr404 } from "../show-reply.js";
import {
	GetGroupedSpectaclesUseCase,
	GetSpectacleUseCase,
	ListSpectaclesUseCase,
	SaveSpectacleUseCase,
} from "./spectacle.useCases.js";

@Controller()
export class SpectacleController {
	private readonly log = toUseCaseLog(new Logger(SpectacleController.name));

	constructor(
		private readonly listSpectacles: ListSpectaclesUseCase,
		private readonly getGroupedSpectacles: GetGroupedSpectaclesUseCase,
		private readonly getSpectacle: GetSpectacleUseCase,
		private readonly saveSpectacle: SaveSpectacleUseCase,
	) {}

	@Get()
	list() {
		return this.listSpectacles.execute(this.log);
	}

	@Get("grouped")
	@Public()
	grouped(
		@Query({ schema: SpectacleGroupedListRequestSchema })
		{ groupByYear }: z.infer<typeof SpectacleGroupedListRequestSchema>,
	) {
		return this.getGroupedSpectacles.execute(groupByYear, this.log);
	}

	@Get(":id")
	@Public()
	get(@Param({ schema: SpectacleDetailsParamsRequestSchema }) { id }: { id: number }) {
		return orNotFound(this.getSpectacle.execute(id, this.log), "Spectacle introuvable");
	}

	@Post("save")
	@SerializeOptions({ schema: SpectacleSchema })
	save(
		@Body({ schema: SaveSpectacleBodyRequestSchema }) body: SaveSpectacleBody,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		return savedOr404(
			response,
			Boolean(body.id),
			this.saveSpectacle.execute(body, this.log),
			"Spectacle introuvable",
		);
	}
}
