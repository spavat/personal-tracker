import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	AnalyticSchema,
	type CreateTagBody,
	CreateTagBodyRequestSchema,
	GetAnalyticsQuerystringRequestSchema,
	TagDetailsSchema,
	TagParamsRequestSchema,
	TagSchema,
	TagWithChildrenSchema,
	type UpdateTagBody,
	UpdateTagBodyRequestSchema,
} from "@personal-tracker/shared/money";

import { TagsService } from "./tags.service.js";

@Controller()
export class TagsController {
	constructor(private readonly service: TagsService) {}

	@Get()
	@SerializeOptions({ schema: TagWithChildrenSchema })
	list() {
		return this.service.list();
	}

	@Get("analytics")
	@SerializeOptions({ schema: AnalyticSchema })
	analytics(@Query({ schema: GetAnalyticsQuerystringRequestSchema }) { splitParent }: { splitParent: boolean }) {
		return this.service.analytics(splitParent);
	}

	@Get(":id")
	@SerializeOptions({ schema: TagDetailsSchema })
	get(@Param({ schema: TagParamsRequestSchema }) { id }: { id: number }) {
		return this.service.get(id);
	}

	@Post()
	@SerializeOptions({ schema: TagSchema })
	create(@Body({ schema: CreateTagBodyRequestSchema }) body: CreateTagBody) {
		return this.service.create(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: TagSchema })
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
