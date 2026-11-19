import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { DeleteReadingParamsRequestSchema } from "@personal-tracker/shared/reading-book";
import {
	MangaDetailsParamsSchema,
	MangaListRequestSchema,
	SaveBodyRequestSchema,
	type SaveBodyRequestType,
} from "@personal-tracker/shared/reading-manga";

import { Public } from "../auth/public.decorator.js";
import { type MangaListQuery, ReadingMangaService } from "./reading-manga.service.js";

@Controller("reading-manga")
export class ReadingMangaController {
	constructor(private readonly service: ReadingMangaService) {}

	@Get("mangas")
	@Public()
	list(@Query({ schema: MangaListRequestSchema }) query: MangaListQuery) {
		return this.service.list(query);
	}

	@Get("mangas/:id")
	@Public()
	get(@Param({ schema: MangaDetailsParamsSchema }) { id }: { id: string }) {
		return this.service.get(id);
	}

	@Post("save")
	@HttpCode(200)
	save(@Body({ schema: SaveBodyRequestSchema }) body: SaveBodyRequestType) {
		return this.service.save(body);
	}

	@Delete("mangas/:id/readings/:readingId")
	deleteReading(
		@Param({ schema: DeleteReadingParamsRequestSchema }) { id, readingId }: { id: string; readingId: string },
	) {
		return this.service.deleteReading(id, readingId);
	}
}
