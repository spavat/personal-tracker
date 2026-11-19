import type { ServerResponse } from "node:http";
import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Res, SerializeOptions } from "@nestjs/common";
import {
	DeleteModelParamsRequestSchema,
	ModelDetailsParamsRequestSchema,
	SaveModelBodyRequestSchema,
	SaveModelResponseSchema,
} from "@personal-tracker/shared/show";

import { orNotFound } from "../show-reply.js";
import { ModelService } from "./model.service.js";

@Controller()
export class ModelController {
	constructor(private readonly service: ModelService) {}

	@Get(":id")
	get(@Param({ schema: ModelDetailsParamsRequestSchema }) { id }: { id: number }) {
		return orNotFound(this.service.get(id), "Modèle introuvable");
	}

	// 201 on create, 200 on update (an unknown model throws NotFoundError)
	@Post("save")
	@SerializeOptions({ schema: SaveModelResponseSchema })
	save(
		@Body({ schema: SaveModelBodyRequestSchema }) body: z.infer<typeof SaveModelBodyRequestSchema>,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		response.statusCode = body.id ? 200 : 201;
		return this.service.save(body);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeleteModelParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
