import type { ServerResponse } from "node:http";
import type { z } from "zod";

import { Body, Controller, Get, Param, Post, Query, Res, SerializeOptions } from "@nestjs/common";
import {
	SaveSpectacleBodyRequestSchema,
	SpectacleDetailsParamsRequestSchema,
	SpectacleGroupedListRequestSchema,
	SpectacleSchema,
} from "@personal-tracker/shared/show";

import type { SaveSpectacleBody } from "./spectacle.entity.js";

import { Public } from "../../auth/public.decorator.js";
import { orNotFound, savedOr404 } from "../show-reply.js";
import { SpectacleService } from "./spectacle.service.js";

@Controller()
export class SpectacleController {
	constructor(private readonly service: SpectacleService) {}

	@Get()
	list() {
		return this.service.list();
	}

	@Get("grouped")
	@Public()
	grouped(
		@Query({ schema: SpectacleGroupedListRequestSchema })
		{ groupByYear }: z.infer<typeof SpectacleGroupedListRequestSchema>,
	) {
		return this.service.listGrouped(groupByYear);
	}

	@Get(":id")
	@Public()
	get(@Param({ schema: SpectacleDetailsParamsRequestSchema }) { id }: { id: number }) {
		return orNotFound(this.service.get(id), "Spectacle introuvable");
	}

	@Post("save")
	@SerializeOptions({ schema: SpectacleSchema })
	save(
		@Body({ schema: SaveSpectacleBodyRequestSchema }) body: SaveSpectacleBody,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		return savedOr404(response, Boolean(body.id), this.service.save(body), "Spectacle introuvable");
	}
}
