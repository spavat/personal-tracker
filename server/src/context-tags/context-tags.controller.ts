import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, SerializeOptions } from "@nestjs/common";
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

	@Post()
	@SerializeOptions({ schema: ContextTagSchema })
	create(@Body({ schema: SaveContextTagRequestSchema }) body: SaveContextTagBody) {
		return this.service.create(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: ContextTagSchema })
	update(
		@Param({ schema: DeleteContextTagParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: SaveContextTagRequestSchema }) body: SaveContextTagBody,
	) {
		return this.service.update(id, body);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeleteContextTagParamsRequestSchema }) { id }: { id: string }) {
		await this.service.delete(id);
	}
}
