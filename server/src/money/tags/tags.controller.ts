import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
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
	@HttpCode(200)
	create(@Body({ schema: CreateTagBodyRequestSchema }) body: CreateTagBody) {
		return this.service.create(body);
	}

	@Post(":id")
	@HttpCode(200)
	update(
		@Param({ schema: TagParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: UpdateTagBodyRequestSchema }) body: UpdateTagBody,
	) {
		return this.service.update(id, body);
	}

	@Delete(":id")
	delete(@Param({ schema: TagParamsRequestSchema }) { id }: { id: number }) {
		return this.service.delete(id);
	}
}
