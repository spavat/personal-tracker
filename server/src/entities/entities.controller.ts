import type { z } from "zod";

import { Body, Controller, Get, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	EntityListQuerystringRequestSchema,
	EntityListResponseSchema,
	EntityParamsRequestSchema,
	type SaveEntityBody,
	SaveEntityBodyRequestSchema,
	SaveEntityResponseSchema,
} from "@personal-tracker/shared/entity";

import { EntitiesService } from "./entities.service.js";

@Controller("entities")
export class EntitiesController {
	constructor(private readonly service: EntitiesService) {}

	@Get()
	@SerializeOptions({ schema: EntityListResponseSchema.element })
	list(
		@Query({ schema: EntityListQuerystringRequestSchema }) query: z.infer<
			typeof EntityListQuerystringRequestSchema
		>,
	) {
		return this.service.list(query);
	}

	// the portrait can be sent as a base64 data URI, within the 15mb JSON limit
	@Post()
	@SerializeOptions({ schema: SaveEntityResponseSchema })
	create(@Body({ schema: SaveEntityBodyRequestSchema }) body: SaveEntityBody) {
		return this.service.create(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: SaveEntityResponseSchema })
	update(
		@Param({ schema: EntityParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: SaveEntityBodyRequestSchema }) body: SaveEntityBody,
	) {
		return this.service.update(id, body);
	}
}
