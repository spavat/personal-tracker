import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, SerializeOptions } from "@nestjs/common";
import {
	LifespanCategoryDeleteParamsRequestSchema,
	LifespanCategoryListResponseSchema,
	LifespanCategorySchema,
	LifespanCategorySaveBodyRequestSchema,
	type LifespanCategorySaveBodyRequestType,
} from "@personal-tracker/shared/lifespan";

import { LifespanCategoriesService } from "./categories.service.js";

@Controller()
export class LifespanCategoriesController {
	constructor(private readonly service: LifespanCategoriesService) {}

	@Get("list")
	@SerializeOptions({ schema: LifespanCategoryListResponseSchema.element })
	list() {
		return this.service.list();
	}

	@Post()
	@SerializeOptions({ schema: LifespanCategorySchema })
	create(@Body({ schema: LifespanCategorySaveBodyRequestSchema }) body: LifespanCategorySaveBodyRequestType) {
		return this.service.create(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: LifespanCategorySchema })
	update(
		@Param({ schema: LifespanCategoryDeleteParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: LifespanCategorySaveBodyRequestSchema }) body: LifespanCategorySaveBodyRequestType,
	) {
		return this.service.update(id, body);
	}

	// 409 with a message when the category still has sub-categories or objects
	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: LifespanCategoryDeleteParamsRequestSchema }) { id }: { id: string }) {
		await this.service.delete(id);
	}
}
