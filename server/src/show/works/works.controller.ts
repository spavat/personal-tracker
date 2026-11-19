import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	DeleteWorkParamsRequestSchema,
	SaveWorkBodyRequestSchema,
	WorkDetailsParamsRequestSchema,
	WorkDetailsResponseSchema,
	WorkGroupedListRequestSchema,
	WorkGroupedListResponseSchema,
	WorkListResponseSchema,
	WorkSchema,
} from "@personal-tracker/shared/show";

import type { SaveWorkBody } from "./work.entity.js";

import { Public } from "../../auth/public.decorator.js";
import { orNotFound } from "../show-reply.utils.js";
import { WorksService } from "./works.service.js";

@Controller()
export class WorksController {
	constructor(private readonly service: WorksService) {}

	@Get()
	@SerializeOptions({ schema: WorkListResponseSchema.element })
	list() {
		return this.service.list();
	}

	@Get("grouped")
	@Public()
	@SerializeOptions({ schema: WorkGroupedListResponseSchema.element })
	grouped(
		@Query({ schema: WorkGroupedListRequestSchema }) { groupByYear }: z.infer<typeof WorkGroupedListRequestSchema>,
	) {
		return this.service.listGrouped(Boolean(groupByYear));
	}

	@Get(":id")
	@SerializeOptions({ schema: WorkDetailsResponseSchema })
	get(@Param({ schema: WorkDetailsParamsRequestSchema }) { id }: { id: number }) {
		return orNotFound(this.service.get(id), "work");
	}

	@Post()
	@SerializeOptions({ schema: WorkSchema })
	create(@Body({ schema: SaveWorkBodyRequestSchema }) body: SaveWorkBody) {
		return orNotFound(this.service.save({ ...body, id: undefined }), "work");
	}

	@Put(":id")
	@SerializeOptions({ schema: WorkSchema })
	update(
		@Param({ schema: WorkDetailsParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: SaveWorkBodyRequestSchema }) body: SaveWorkBody,
	) {
		return orNotFound(this.service.save({ ...body, id }), "work");
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeleteWorkParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
