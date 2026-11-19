import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	DeletePlaceParamsRequestSchema,
	PlaceDetailsParamsRequestSchema,
	PlaceDetailsQuerystringRequestSchema,
	PlaceListQuerystringRequestSchema,
	SavePlaceBodyRequestSchema,
	SavePlaceResponseSchema,
} from "@personal-tracker/shared/show";

import type { SavePlaceBody } from "./place.entity.js";

import { Public } from "../../auth/public.decorator.js";
import { orNotFound } from "../show-reply.utils.js";
import { PlacesService } from "./places.service.js";

@Controller()
export class PlacesController {
	constructor(private readonly service: PlacesService) {}

	@Get()
	@Public()
	list(
		@Query({ schema: PlaceListQuerystringRequestSchema }) {
			sort,
		}: z.infer<typeof PlaceListQuerystringRequestSchema>,
	) {
		return this.service.list(sort);
	}

	@Get(":id")
	@Public()
	get(
		@Param({ schema: PlaceDetailsParamsRequestSchema }) { id }: { id: number },
		@Query({ schema: PlaceDetailsQuerystringRequestSchema })
		{ groupBySpectacle }: z.infer<typeof PlaceDetailsQuerystringRequestSchema>,
	) {
		return orNotFound(
			this.service.get({ placeId: id, groupBySpectacle: Boolean(groupBySpectacle) }),
			"Salle introuvable",
		);
	}

	@Post()
	@SerializeOptions({ schema: SavePlaceResponseSchema })
	create(@Body({ schema: SavePlaceBodyRequestSchema }) body: SavePlaceBody) {
		return orNotFound(this.service.save({ ...body, id: undefined }), "Salle introuvable");
	}

	@Put(":id")
	@SerializeOptions({ schema: SavePlaceResponseSchema })
	update(
		@Param({ schema: PlaceDetailsParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: SavePlaceBodyRequestSchema }) body: SavePlaceBody,
	) {
		return orNotFound(this.service.save({ ...body, id }), "Salle introuvable");
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeletePlaceParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
