import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	ArtistDetailsParamsRequestSchema,
	ArtistDetailsQuerystringRequestSchema,
	ArtistListQuerystringRequestSchema,
	ArtistViewSchema,
	DeleteArtistParamsRequestSchema,
	SaveArtistBodyRequestSchema,
} from "@personal-tracker/shared/show";

import { Public } from "../../auth/public.decorator.js";
import { orNotFound } from "../show-reply.utils.js";
import { ArtistsService } from "./artists.service.js";

@Controller()
export class ArtistsController {
	constructor(private readonly service: ArtistsService) {}

	@Get()
	@Public()
	list(
		@Query({ schema: ArtistListQuerystringRequestSchema }) {
			sort,
		}: z.infer<typeof ArtistListQuerystringRequestSchema>,
	) {
		return this.service.list(sort);
	}

	@Get(":id")
	@Public()
	get(
		@Param({ schema: ArtistDetailsParamsRequestSchema }) { id }: { id: number },
		@Query({ schema: ArtistDetailsQuerystringRequestSchema })
		{ groupBySpectacle }: z.infer<typeof ArtistDetailsQuerystringRequestSchema>,
	) {
		return orNotFound(this.service.get({ artistId: id, groupBySpectacle }), "artist");
	}

	@Post()
	@SerializeOptions({ schema: ArtistViewSchema })
	create(@Body({ schema: SaveArtistBodyRequestSchema }) body: z.infer<typeof SaveArtistBodyRequestSchema>) {
		return orNotFound(this.service.save({ ...body, id: undefined }), "artist");
	}

	@Put(":id")
	@SerializeOptions({ schema: ArtistViewSchema })
	update(
		@Param({ schema: ArtistDetailsParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: SaveArtistBodyRequestSchema }) body: z.infer<typeof SaveArtistBodyRequestSchema>,
	) {
		return orNotFound(this.service.save({ ...body, id }), "artist");
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeleteArtistParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
