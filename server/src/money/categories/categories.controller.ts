import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, SerializeOptions } from "@nestjs/common";
import {
	CategoryDetailsSchema,
	CategoryParamsRequestSchema,
	CategorySchema,
	CategoryWithChildrenSchema,
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
	@SerializeOptions({ schema: CategoryWithChildrenSchema })
	list() {
		return this.service.list();
	}

	@Get(":id")
	@SerializeOptions({ schema: CategoryDetailsSchema })
	getCategory(@Param({ schema: CategoryParamsRequestSchema }) { id }: { id: number }) {
		return this.service.getCategory(id);
	}

	@Post()
	@SerializeOptions({ schema: CategorySchema })
	create(@Body({ schema: CreateCategoryBodyRequestSchema }) body: CreateCategoryBody) {
		return this.service.create(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: CategorySchema })
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
