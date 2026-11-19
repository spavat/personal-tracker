import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import {
	type CreateTagBody,
	CreateTagBodyRequestSchema,
	GetAnalyticsQuerystringRequestSchema,
	TagParamsRequestSchema,
	type UpdateTagBody,
	UpdateTagBodyRequestSchema,
} from "@personal-tracker/shared/money";

import { TagsService } from "./tags.service.js";

@Controller()
export class TagsController {
	constructor(private readonly service: TagsService) {}

	@Get()
	list() {
		return this.service.list();
	}

	@Get("analytics")
	analytics(@Query({ schema: GetAnalyticsQuerystringRequestSchema }) { splitParent }: { splitParent: boolean }) {
		return this.service.analytics(splitParent);
	}

	@Get(":id")
	get(@Param({ schema: TagParamsRequestSchema }) { id }: { id: number }) {
		return this.service.get(id);
	}

	@Post()
	create(@Body({ schema: CreateTagBodyRequestSchema }) body: CreateTagBody) {
		return this.service.create(body);
	}

	@Put(":id")
	update(
		@Param({ schema: TagParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: UpdateTagBodyRequestSchema }) body: UpdateTagBody,
	) {
		return this.service.update(id, body);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: TagParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
