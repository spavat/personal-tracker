import { Controller, Get, Post, Put, Delete, Param, HttpCode, Body } from "@nestjs/common";
import {
	CategoryParamsRequestSchema,
	CreateCategoryBody,
	CreateCategoryBodyRequestSchema,
	UpdateCategoryBody,
	UpdateCategoryBodyRequestSchema,
} from "@personal-tracker/shared/money";

import { CategoriesService } from "./categories.service.js";

@Controller()
export class CategoriesController {
	constructor(private readonly service: CategoriesService) {}

	@Get()
	list() {
		return this.service.list();
	}

	@Get(":id")
	getCategory(@Param({ schema: CategoryParamsRequestSchema }) { id }: { id: number }) {
		return this.service.getCategory(id);
	}

	@Post()
	create(@Body({ schema: CreateCategoryBodyRequestSchema }) body: CreateCategoryBody) {
		return this.service.create(body);
	}

	@Put(":id")
	update(
		@Param({ schema: CategoryParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: UpdateCategoryBodyRequestSchema }) body: UpdateCategoryBody,
	) {
		return this.service.update(id, body);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: CategoryParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
