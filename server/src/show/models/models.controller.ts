import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, SerializeOptions } from "@nestjs/common";
import {
	DeleteModelParamsRequestSchema,
	ModelDetailsParamsRequestSchema,
	ModelDetailsResponseSchema,
	SaveModelBodyRequestSchema,
	SaveModelResponseSchema,
} from "@personal-tracker/shared/show";

import { orNotFound } from "../show-reply.utils.js";
import { ModelsService } from "./models.service.js";

@Controller()
export class ModelsController {
	constructor(private readonly service: ModelsService) {}

	@Get(":id")
	@SerializeOptions({ schema: ModelDetailsResponseSchema })
	get(@Param({ schema: ModelDetailsParamsRequestSchema }) { id }: { id: string }) {
		return orNotFound(this.service.get(id), "model");
	}

	// 201 on create, 200 on update (an unknown model throws NotFoundError)
	@Post()
	@SerializeOptions({ schema: SaveModelResponseSchema })
	create(@Body({ schema: SaveModelBodyRequestSchema }) body: z.infer<typeof SaveModelBodyRequestSchema>) {
		return this.service.save(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: SaveModelResponseSchema })
	update(
		@Param({ schema: ModelDetailsParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: SaveModelBodyRequestSchema }) body: z.infer<typeof SaveModelBodyRequestSchema>,
	) {
		return this.service.save({ ...body, id });
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeleteModelParamsRequestSchema }) { id }: { id: string }) {
		await this.service.delete(id);
	}
}
