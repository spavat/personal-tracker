import type { ServerResponse } from "node:http";
import type { z } from "zod";

import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Logger,
	Param,
	Post,
	Query,
	Res,
	SerializeOptions,
} from "@nestjs/common";
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
import { toUseCaseLog } from "../../common/use-case-log.js";
import { orNotFound, savedOr404 } from "../show-reply.js";
import { DeletePlaceUseCase, GetPlaceUseCase, ListPlacesUseCase, SavePlaceUseCase } from "./place.useCases.js";

@Controller()
export class PlaceController {
	private readonly log = toUseCaseLog(new Logger(PlaceController.name));

	constructor(
		private readonly listPlaces: ListPlacesUseCase,
		private readonly getPlace: GetPlaceUseCase,
		private readonly savePlace: SavePlaceUseCase,
		private readonly deletePlace: DeletePlaceUseCase,
	) {}

	@Get()
	@Public()
	list(
		@Query({ schema: PlaceListQuerystringRequestSchema }) {
			sort,
		}: z.infer<typeof PlaceListQuerystringRequestSchema>,
	) {
		return this.listPlaces.execute(sort, this.log);
	}

	@Get(":id")
	@Public()
	get(
		@Param({ schema: PlaceDetailsParamsRequestSchema }) { id }: { id: number },
		@Query({ schema: PlaceDetailsQuerystringRequestSchema })
		{ groupBySpectacle }: z.infer<typeof PlaceDetailsQuerystringRequestSchema>,
	) {
		return orNotFound(
			this.getPlace.execute({ placeId: id, groupBySpectacle: Boolean(groupBySpectacle) }, this.log),
			"Salle introuvable",
		);
	}

	@Post("save")
	@SerializeOptions({ schema: SavePlaceResponseSchema })
	save(
		@Body({ schema: SavePlaceBodyRequestSchema }) body: SavePlaceBody,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		return savedOr404(response, Boolean(body.id), this.savePlace.execute(body, this.log), "Salle introuvable");
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeletePlaceParamsRequestSchema }) { id }: { id: number }) {
		await this.deletePlace.execute(id, this.log);
	}
}
