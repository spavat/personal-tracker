import type { ServerResponse } from "node:http";
import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Res, SerializeOptions } from "@nestjs/common";
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
import { orNotFound, savedOr404 } from "../show-reply.js";
import { PlaceService } from "./place.service.js";

@Controller()
export class PlaceController {
	constructor(private readonly service: PlaceService) {}

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

	@Post("save")
	@SerializeOptions({ schema: SavePlaceResponseSchema })
	save(
		@Body({ schema: SavePlaceBodyRequestSchema }) body: SavePlaceBody,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		return savedOr404(response, Boolean(body.id), this.service.save(body), "Salle introuvable");
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeletePlaceParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
