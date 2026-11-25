import type { z } from "zod";

import { Body, Controller, Get, HttpCode, Param, Post, Query, SerializeOptions } from "@nestjs/common";
import {
	EntityDirectoryItemSchema,
	EntityDirectoryQuerystringRequestSchema,
	EntityDirectoryResponseSchema,
	type EntityMergeBody,
	EntityMergeBodySchema,
	EntityParamsRequestSchema,
} from "@personal-tracker/shared/entity";

import { IsOwner } from "../../auth/is-owner.decorator.js";
import { Public } from "../../auth/public.decorator.js";
import { DirectoryService } from "./directory.service.js";

@Controller("entities")
export class DirectoryController {
	constructor(private readonly service: DirectoryService) {}

	@Get("directory")
	@Public()
	@SerializeOptions({ schema: EntityDirectoryResponseSchema.element })
	list(
		@Query({ schema: EntityDirectoryQuerystringRequestSchema })
		query: z.infer<typeof EntityDirectoryQuerystringRequestSchema>,
		@IsOwner() isOwner: boolean,
	) {
		return this.service.list(query, isOwner);
	}

	@Get("directory/:id")
	@Public()
	@SerializeOptions({ schema: EntityDirectoryItemSchema })
	get(@Param({ schema: EntityParamsRequestSchema }) { id }: { id: string }, @IsOwner() isOwner: boolean) {
		return this.service.get(id, isOwner);
	}

	@Post("merge")
	@HttpCode(200)
	@SerializeOptions({ schema: EntityDirectoryItemSchema })
	merge(@Body({ schema: EntityMergeBodySchema }) body: EntityMergeBody) {
		return this.service.merge(body);
	}
}
