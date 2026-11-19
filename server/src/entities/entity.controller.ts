import type { ServerResponse } from "node:http";
import type { z } from "zod";

import { Body, Controller, Get, Logger, Post, Query, Res, SerializeOptions } from "@nestjs/common";
import {
	EntityListQuerystringRequestSchema,
	EntityListResponseSchema,
	type SaveEntityBody,
	SaveEntityBodyRequestSchema,
	SaveEntityResponseSchema,
} from "@personal-tracker/shared/entity";

import { NotFoundError } from "../common/errors.js";
import { toUseCaseLog } from "../common/use-case-log.js";
import { ListEntitiesUseCase, SaveEntityUseCase } from "./entity.useCases.js";

@Controller("entities")
export class EntityController {
	private readonly log = toUseCaseLog(new Logger(EntityController.name));

	constructor(
		private readonly listEntities: ListEntitiesUseCase,
		private readonly saveEntity: SaveEntityUseCase,
	) {}

	@Get()
	@SerializeOptions({ schema: EntityListResponseSchema.element })
	list(
		@Query({ schema: EntityListQuerystringRequestSchema }) query: z.infer<
			typeof EntityListQuerystringRequestSchema
		>,
	) {
		return this.listEntities.execute(query, this.log);
	}

	// 201 with the new entity on create, 200 with the updated one on update (see show-reply.ts); the portrait can
	// be sent as a base64 data URI, within the 15mb JSON limit
	@Post("save")
	@SerializeOptions({ schema: SaveEntityResponseSchema })
	async save(
		@Body({ schema: SaveEntityBodyRequestSchema }) body: SaveEntityBody,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		const entity = await this.saveEntity.execute(body, this.log);
		if (!entity) {
			throw new NotFoundError("Entité introuvable");
		}
		response.statusCode = body.id ? 200 : 201;
		return entity;
	}
}
