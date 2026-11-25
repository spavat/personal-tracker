import type { z } from "zod";

import { Controller, Get, Param, Query, SerializeOptions } from "@nestjs/common";
import {
	EntityDirectoryItemSchema,
	EntityDirectoryQuerystringRequestSchema,
	EntityDirectoryResponseSchema,
	EntityParamsRequestSchema,
} from "@personal-tracker/shared/entity";

import { IsOwner } from "../../auth/is-owner.decorator.js";
import { Public } from "../../auth/public.decorator.js";
import { DirectoryService } from "./directory.service.js";

@Controller("entities/directory")
export class DirectoryController {
	constructor(private readonly service: DirectoryService) {}

	@Get()
	@Public()
	@SerializeOptions({ schema: EntityDirectoryResponseSchema.element })
	list(
		@Query({ schema: EntityDirectoryQuerystringRequestSchema })
		query: z.infer<typeof EntityDirectoryQuerystringRequestSchema>,
		@IsOwner() isOwner: boolean,
	) {
		return this.service.list(query, isOwner);
	}

	@Get(":id")
	@Public()
	@SerializeOptions({ schema: EntityDirectoryItemSchema })
	get(@Param({ schema: EntityParamsRequestSchema }) { id }: { id: string }, @IsOwner() isOwner: boolean) {
		return this.service.get(id, isOwner);
	}
}
