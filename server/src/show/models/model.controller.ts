import type { ServerResponse } from "node:http";
import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Logger, Param, Post, Res, SerializeOptions } from "@nestjs/common";
import {
	DeleteModelParamsRequestSchema,
	ModelDetailsParamsRequestSchema,
	SaveModelBodyRequestSchema,
	SaveModelResponseSchema,
} from "@personal-tracker/shared/show";

import { toUseCaseLog } from "../../common/use-case-log.js";
import { orNotFound } from "../show-reply.js";
import { DeleteModelUseCase, GetModelUseCase, SaveModelUseCase } from "./model.useCases.js";

@Controller()
export class ModelController {
	private readonly log = toUseCaseLog(new Logger(ModelController.name));

	constructor(
		private readonly getModel: GetModelUseCase,
		private readonly saveModel: SaveModelUseCase,
		private readonly deleteModel: DeleteModelUseCase,
	) {}

	@Get(":id")
	get(@Param({ schema: ModelDetailsParamsRequestSchema }) { id }: { id: number }) {
		return orNotFound(this.getModel.execute(id, this.log), "Modèle introuvable");
	}

	// 201 on create, 200 on update (an unknown model throws NotFoundError)
	@Post("save")
	@SerializeOptions({ schema: SaveModelResponseSchema })
	save(
		@Body({ schema: SaveModelBodyRequestSchema }) body: z.infer<typeof SaveModelBodyRequestSchema>,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		response.statusCode = body.id ? 200 : 201;
		return this.saveModel.execute(body, this.log);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeleteModelParamsRequestSchema }) { id }: { id: number }) {
		await this.deleteModel.execute(id, this.log);
	}
}
