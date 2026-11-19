import type { ServerResponse } from "node:http";
import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Res, SerializeOptions } from "@nestjs/common";
import {
	DeletePerformanceParamsRequestSchema,
	PerformanceDetailsParamsRequestSchema,
	PerformanceListQuerystringRequestSchema,
	SaveCastingBodyRequestSchema,
	SavePerformanceBodyRequestSchema,
	SavePerformanceResponseSchema,
} from "@personal-tracker/shared/show";

import type { SaveCastingBody, SavePerformanceBody } from "./performance.entity.js";

import { Public } from "../../auth/public.decorator.js";
import { orNotFound } from "../show-reply.utils.js";
import { PerformancesService } from "./performances.service.js";

@Controller()
export class PerformancesController {
	constructor(private readonly service: PerformancesService) {}

	// a visitor only sees the performances older than a week (database/visible-performance.ts)
	@Get()
	@Public()
	list(
		@Query({ schema: PerformanceListQuerystringRequestSchema }) query: z.infer<
			typeof PerformanceListQuerystringRequestSchema
		>,
	) {
		return this.service.list(query);
	}

	@Get(":performanceId")
	@Public()
	get(@Param({ schema: PerformanceDetailsParamsRequestSchema }) { performanceId }: { performanceId: number }) {
		return orNotFound(this.service.get(performanceId), "Représentation introuvable");
	}

	// 201 on create, 200 on update (an unknown performance throws NotFoundError)
	@Post("save")
	@SerializeOptions({ schema: SavePerformanceResponseSchema })
	save(
		@Body({ schema: SavePerformanceBodyRequestSchema }) body: SavePerformanceBody,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		response.statusCode = body.performance.id ? 200 : 201;
		return this.service.save(body);
	}

	// replaces the whole casting: nothing to send back
	@Post("saveCasting")
	@HttpCode(204)
	async saveCastingRoute(@Body({ schema: SaveCastingBodyRequestSchema }) body: SaveCastingBody) {
		await this.service.saveCasting(body);
	}

	// the casting roles, and their portraits used nowhere else, are deleted along with the performance
	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeletePerformanceParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
