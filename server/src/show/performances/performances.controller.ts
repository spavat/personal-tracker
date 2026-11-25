import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	DeletePerformanceParamsRequestSchema,
	PerformanceDetailsParamsRequestSchema,
	PerformanceDetailsResponseSchema,
	PerformanceListQuerystringRequestSchema,
	PerformanceViewSchema,
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
	@SerializeOptions({ schema: PerformanceViewSchema })
	list(
		@Query({ schema: PerformanceListQuerystringRequestSchema }) query: z.infer<
			typeof PerformanceListQuerystringRequestSchema
		>,
	) {
		return this.service.list(query);
	}

	@Get(":performanceId")
	@Public()
	@SerializeOptions({ schema: PerformanceDetailsResponseSchema })
	get(@Param({ schema: PerformanceDetailsParamsRequestSchema }) { performanceId }: { performanceId: string }) {
		return orNotFound(this.service.get(performanceId), "performance");
	}

	// 201 on create, 200 on update (an unknown performance throws NotFoundError)
	// a new place, spectacle or work can be sent instead of its id: created along with the performance
	@Post()
	@SerializeOptions({ schema: SavePerformanceResponseSchema })
	create(@Body({ schema: SavePerformanceBodyRequestSchema }) body: SavePerformanceBody) {
		return this.service.save(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: SavePerformanceResponseSchema })
	update(
		@Param({ schema: DeletePerformanceParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: SavePerformanceBodyRequestSchema }) body: SavePerformanceBody,
	) {
		return this.service.save(body, id);
	}

	// replaces the whole casting: nothing to send back
	@Put(":id/casting")
	@HttpCode(204)
	async saveCasting(
		@Param({ schema: DeletePerformanceParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: SaveCastingBodyRequestSchema }) body: SaveCastingBody,
	) {
		await this.service.saveCasting(id, body);
	}

	// the casting roles, and their portraits used nowhere else, are deleted along with the performance
	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeletePerformanceParamsRequestSchema }) { id }: { id: string }) {
		await this.service.delete(id);
	}
}
