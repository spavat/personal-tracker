import {
	Body,
	ConflictException,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Post,
	SerializeOptions,
} from "@nestjs/common";
import {
	LifespanCategoryDeleteParamsRequestSchema,
	LifespanCategoryListResponseSchema,
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

	@Post("save")
	@HttpCode(200)
	save(@Body({ schema: LifespanCategorySaveBodyRequestSchema }) body: LifespanCategorySaveBodyRequestType) {
		return this.service.save(body);
	}

	@Delete(":id")
	async delete(@Param({ schema: LifespanCategoryDeleteParamsRequestSchema }) { id }: { id: string }) {
		const result = await this.service.delete(id);
		if (!result.deleted) {
			// the front reads the reason from the 409 body: an object response is sent as is
			throw new ConflictException(result);
		}
		return result;
	}
}
