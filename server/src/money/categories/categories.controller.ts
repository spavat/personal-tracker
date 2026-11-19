import { Controller, Get, Post, Delete, Param, HttpCode, Body } from "@nestjs/common";
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
	@HttpCode(200)
	create(@Body({ schema: CreateCategoryBodyRequestSchema }) body: CreateCategoryBody) {
		return this.service.create(body);
	}

	@Post(":id")
	@HttpCode(200)
	update(
		@Param({ schema: CategoryParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: UpdateCategoryBodyRequestSchema }) body: UpdateCategoryBody,
	) {
		return this.service.update(id, body);
	}

	@Delete(":id")
	delete(@Param({ schema: CategoryParamsRequestSchema }) { id }: { id: number }) {
		return this.service.delete(id);
	}
}
