import type { z } from "zod";

import { Body, Controller, Get, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	SaveSpectacleBodyRequestSchema,
	SpectacleDetailsParamsRequestSchema,
	SpectacleGroupedListRequestSchema,
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
		return orNotFound(this.service.get(id), "spectacle");
	}

	@Post()
	@SerializeOptions({ schema: SpectacleSchema })
	create(@Body({ schema: SaveSpectacleBodyRequestSchema }) body: SaveSpectacleBody) {
		return orNotFound(this.service.save({ ...body, id: undefined }), "spectacle");
	}

	@Put(":id")
	@SerializeOptions({ schema: SpectacleSchema })
	update(
		@Param({ schema: SpectacleDetailsParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: SaveSpectacleBodyRequestSchema }) body: SaveSpectacleBody,
	) {
		return orNotFound(this.service.save({ ...body, id }), "spectacle");
	}
}
