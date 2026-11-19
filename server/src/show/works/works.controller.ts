import type { ServerResponse } from "node:http";
import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Res, SerializeOptions } from "@nestjs/common";
import {
	DeleteWorkParamsRequestSchema,
	SaveWorkBodyRequestSchema,
	WorkDetailsParamsRequestSchema,
	WorkGroupedListRequestSchema,
	WorkSchema,
} from "@personal-tracker/shared/show";

import type { SaveWorkBody } from "./work.entity.js";

import { Public } from "../../auth/public.decorator.js";
import { orNotFound, savedOr404 } from "../show-reply.utils.js";
import { WorksService } from "./works.service.js";

@Controller()
export class WorksController {
	constructor(private readonly service: WorksService) {}

	@Get()
	list() {
		return this.service.list();
	}

	@Get("grouped")
	@Public()
	grouped(
		@Query({ schema: WorkGroupedListRequestSchema }) { groupByYear }: z.infer<typeof WorkGroupedListRequestSchema>,
	) {
		return this.service.listGrouped(Boolean(groupByYear));
	}

	@Get(":id")
	get(@Param({ schema: WorkDetailsParamsRequestSchema }) { id }: { id: number }) {
		return orNotFound(this.service.get(id), "Œuvre introuvable");
	}

	@Post("save")
	@SerializeOptions({ schema: WorkSchema })
	save(
		@Body({ schema: SaveWorkBodyRequestSchema }) body: SaveWorkBody,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		return savedOr404(response, Boolean(body.id), this.service.save(body), "Œuvre introuvable");
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeleteWorkParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
