import type { ServerResponse } from "node:http";
import type { z } from "zod";

import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Logger,
	Param,
	Post,
	Query,
	Res,
	SerializeOptions,
} from "@nestjs/common";
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
import { toUseCaseLog } from "../../common/use-case-log.js";
import { orNotFound } from "../show-reply.js";
import {
	DeletePerformanceUseCase,
	GetPerformanceUseCase,
	ListPerformancesUseCase,
	SaveCastingUseCase,
	SavePerformanceUseCase,
} from "./performance.useCases.js";

@Controller()
export class PerformanceController {
	private readonly log = toUseCaseLog(new Logger(PerformanceController.name));

	constructor(
		private readonly listPerformances: ListPerformancesUseCase,
		private readonly getPerformance: GetPerformanceUseCase,
		private readonly savePerformance: SavePerformanceUseCase,
		private readonly saveCasting: SaveCastingUseCase,
		private readonly deletePerformance: DeletePerformanceUseCase,
	) {}

	// a visitor only sees the performances older than a week (database/visible-performance.ts)
	@Get()
	@Public()
	list(
		@Query({ schema: PerformanceListQuerystringRequestSchema }) query: z.infer<
			typeof PerformanceListQuerystringRequestSchema
		>,
	) {
		return this.listPerformances.execute(query, this.log);
	}

	@Get(":performanceId")
	@Public()
	get(@Param({ schema: PerformanceDetailsParamsRequestSchema }) { performanceId }: { performanceId: number }) {
		return orNotFound(this.getPerformance.execute(performanceId, this.log), "Représentation introuvable");
	}

	// 201 on create, 200 on update (an unknown performance throws NotFoundError)
	@Post("save")
	@SerializeOptions({ schema: SavePerformanceResponseSchema })
	save(
		@Body({ schema: SavePerformanceBodyRequestSchema }) body: SavePerformanceBody,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		response.statusCode = body.performance.id ? 200 : 201;
		return this.savePerformance.execute(body, this.log);
	}

	// replaces the whole casting: nothing to send back
	@Post("saveCasting")
	@HttpCode(204)
	async saveCastingRoute(@Body({ schema: SaveCastingBodyRequestSchema }) body: SaveCastingBody) {
		await this.saveCasting.execute(body, this.log);
	}

	// the casting roles, and their portraits used nowhere else, are deleted along with the performance
	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeletePerformanceParamsRequestSchema }) { id }: { id: number }) {
		await this.deletePerformance.execute(id, this.log);
	}
}
