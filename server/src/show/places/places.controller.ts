import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	DeletePlaceParamsRequestSchema,
	PlaceDetailsParamsRequestSchema,
	PlaceDetailsQuerystringRequestSchema,
	PlaceDetailsResponseSchema,
	PlaceListQuerystringRequestSchema,
	PlaceListResponseSchema,
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
	@SerializeOptions({ schema: PlaceListResponseSchema.element })
	list(
		@Query({ schema: PlaceListQuerystringRequestSchema }) {
			sort,
		}: z.infer<typeof PlaceListQuerystringRequestSchema>,
	) {
		return this.service.list(sort);
	}

	@Get(":id")
	@Public()
	@SerializeOptions({ schema: PlaceDetailsResponseSchema })
	get(
		@Param({ schema: PlaceDetailsParamsRequestSchema }) { id }: { id: number },
		@Query({ schema: PlaceDetailsQuerystringRequestSchema })
		{ groupBySpectacle }: z.infer<typeof PlaceDetailsQuerystringRequestSchema>,
	) {
		return orNotFound(this.service.get({ placeId: id, groupBySpectacle: Boolean(groupBySpectacle) }), "place");
	}

	@Post()
	@SerializeOptions({ schema: SavePlaceResponseSchema })
	create(@Body({ schema: SavePlaceBodyRequestSchema }) body: SavePlaceBody) {
		return orNotFound(this.service.save(body), "place");
	}

	@Put(":id")
	@SerializeOptions({ schema: SavePlaceResponseSchema })
	update(
		@Param({ schema: PlaceDetailsParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: SavePlaceBodyRequestSchema }) body: SavePlaceBody,
	) {
		return orNotFound(this.service.save({ ...body, id }), "place");
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeletePlaceParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
