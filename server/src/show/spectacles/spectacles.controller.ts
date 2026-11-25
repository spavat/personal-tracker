import type { z } from "zod";

import { Body, Controller, Get, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	SaveSpectacleBodyRequestSchema,
	SpectacleDetailsParamsRequestSchema,
	SpectacleDetailsResponseSchema,
	SpectacleGroupedListRequestSchema,
	SpectacleGroupedListResponseSchema,
	SpectacleListResponseSchema,
	SpectacleSchema,
} from "@personal-tracker/shared/show";

import type { SaveSpectacleBody } from "./spectacle.entity.js";

import { Public } from "../../auth/public.decorator.js";
import { orNotFound } from "../show-reply.utils.js";
import { SpectaclesService } from "./spectacles.service.js";

@Controller()
export class SpectaclesController {
	constructor(private readonly service: SpectaclesService) {}

	@Get()
	@SerializeOptions({ schema: SpectacleListResponseSchema.element })
	list() {
		return this.service.list();
	}

	@Get("grouped")
	@Public()
	@SerializeOptions({ schema: SpectacleGroupedListResponseSchema.element })
	grouped(
		@Query({ schema: SpectacleGroupedListRequestSchema })
		{ groupByYear }: z.infer<typeof SpectacleGroupedListRequestSchema>,
	) {
		return this.service.listGrouped(groupByYear);
	}

	@Get(":id")
	@Public()
	@SerializeOptions({ schema: SpectacleDetailsResponseSchema })
	get(@Param({ schema: SpectacleDetailsParamsRequestSchema }) { id }: { id: string }) {
		return orNotFound(this.service.get(id), "spectacle");
	}

	@Post()
	@SerializeOptions({ schema: SpectacleSchema })
	create(@Body({ schema: SaveSpectacleBodyRequestSchema }) body: SaveSpectacleBody) {
		return orNotFound(this.service.save(body), "spectacle");
	}

	@Put(":id")
	@SerializeOptions({ schema: SpectacleSchema })
	update(
		@Param({ schema: SpectacleDetailsParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: SaveSpectacleBodyRequestSchema }) body: SaveSpectacleBody,
	) {
		return orNotFound(this.service.save({ ...body, id }), "spectacle");
	}
}
