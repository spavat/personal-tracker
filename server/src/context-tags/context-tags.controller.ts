import { Controller, Get, Post, Delete, Param, HttpCode, Body, SerializeOptions } from "@nestjs/common";
import {
	ContextTagSchema,
	DeleteContextTagParamsRequestSchema,
	SaveContextTagBody,
	SaveContextTagRequestSchema,
} from "@personal-tracker/shared/context-tag";

import { ContextTagsService } from "./context-tags.service.js";

@Controller("context-tags")
export class ContextTagsController {
	constructor(private readonly service: ContextTagsService) {}

	@Get("list")
	@SerializeOptions({ schema: ContextTagSchema })
	list() {
		return this.service.list();
	}

	@Post("save")
	@HttpCode(200)
	save(@Body({ schema: SaveContextTagRequestSchema }) body: SaveContextTagBody) {
		return this.service.save(body);
	}

	@Delete(":id")
	delete(@Param({ schema: DeleteContextTagParamsRequestSchema }) { id }: { id: string }) {
		return this.service.delete(id);
	}
}
