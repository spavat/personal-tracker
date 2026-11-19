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
	ArtistDetailsParamsRequestSchema,
	ArtistDetailsQuerystringRequestSchema,
	ArtistListQuerystringRequestSchema,
	ArtistViewSchema,
	DeleteArtistParamsRequestSchema,
	SaveArtistBodyRequestSchema,
} from "@personal-tracker/shared/show";

import { Public } from "../../auth/public.decorator.js";
import { toUseCaseLog } from "../../common/use-case-log.js";
import { orNotFound, savedOr404 } from "../show-reply.js";
import { DeleteArtistUseCase, GetArtistUseCase, ListArtistsUseCase, SaveArtistUseCase } from "./artist.useCases.js";

@Controller()
export class ArtistController {
	private readonly log = toUseCaseLog(new Logger(ArtistController.name));

	constructor(
		private readonly listArtists: ListArtistsUseCase,
		private readonly getArtist: GetArtistUseCase,
		private readonly saveArtist: SaveArtistUseCase,
		private readonly deleteArtist: DeleteArtistUseCase,
	) {}

	@Get()
	@Public()
	list(
		@Query({ schema: ArtistListQuerystringRequestSchema }) {
			sort,
		}: z.infer<typeof ArtistListQuerystringRequestSchema>,
	) {
		return this.listArtists.execute(sort, this.log);
	}

	@Get(":id")
	@Public()
	get(
		@Param({ schema: ArtistDetailsParamsRequestSchema }) { id }: { id: number },
		@Query({ schema: ArtistDetailsQuerystringRequestSchema })
		{ groupBySpectacle }: z.infer<typeof ArtistDetailsQuerystringRequestSchema>,
	) {
		return orNotFound(this.getArtist.execute({ artistId: id, groupBySpectacle }, this.log), "Artiste introuvable");
	}

	@Post("save")
	@SerializeOptions({ schema: ArtistViewSchema })
	save(
		@Body({ schema: SaveArtistBodyRequestSchema }) body: z.infer<typeof SaveArtistBodyRequestSchema>,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		return savedOr404(response, Boolean(body.id), this.saveArtist.execute(body, this.log), "Artiste introuvable");
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeleteArtistParamsRequestSchema }) { id }: { id: number }) {
		await this.deleteArtist.execute(id, this.log);
	}
}
