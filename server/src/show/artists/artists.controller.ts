import type { z } from "zod";

import { Controller, Get, Param, Query, SerializeOptions } from "@nestjs/common";
import {
	ArtistDetailsParamsRequestSchema,
	ArtistDetailsQuerystringRequestSchema,
	ArtistDetailsResponseSchema,
	ArtistListQuerystringRequestSchema,
	ArtistListResponseSchema,
} from "@personal-tracker/shared/show";

import { Public } from "../../auth/public.decorator.js";
import { orNotFound } from "../show-reply.utils.js";
import { ArtistsService } from "./artists.service.js";

// Read only: an artist is an entity, edited through /entities and created by the casting and model forms
@Controller()
export class ArtistsController {
	constructor(private readonly service: ArtistsService) {}

	@Get()
	@Public()
	@SerializeOptions({ schema: ArtistListResponseSchema.element })
	list(
		@Query({ schema: ArtistListQuerystringRequestSchema }) {
			sort,
		}: z.infer<typeof ArtistListQuerystringRequestSchema>,
	) {
		return this.service.list(sort);
	}

	@Get(":id")
	@Public()
	@SerializeOptions({ schema: ArtistDetailsResponseSchema })
	get(
		@Param({ schema: ArtistDetailsParamsRequestSchema }) { id }: { id: string },
		@Query({ schema: ArtistDetailsQuerystringRequestSchema })
		{ groupBySpectacle }: z.infer<typeof ArtistDetailsQuerystringRequestSchema>,
	) {
		return orNotFound(this.service.get({ artistId: id, groupBySpectacle }), "artist");
	}
}
