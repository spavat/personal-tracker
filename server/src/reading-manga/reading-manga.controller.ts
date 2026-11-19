import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import { DeleteReadingParamsRequestSchema } from "@personal-tracker/shared/reading-book";
import {
	MangaDetailsParamsSchema,
	MangaListRequestSchema,
	MangaOverviewSchema,
	MangaSchema,
	ReadingSchema,
	SaveBodyRequestSchema,
	type SaveBodyRequestType,
	SaveReadingBodyRequestSchema,
	type SaveReadingBodyRequestType,
	SaveResponseSchema,
} from "@personal-tracker/shared/reading-manga";

import { Public } from "../auth/public.decorator.js";
import { type MangaListQuery, ReadingMangaService } from "./reading-manga.service.js";

@Controller("reading-manga")
export class ReadingMangaController {
	constructor(private readonly service: ReadingMangaService) {}

	@Get("mangas")
	@Public()
	@SerializeOptions({ schema: MangaOverviewSchema })
	list(@Query({ schema: MangaListRequestSchema }) query: MangaListQuery) {
		return this.service.list(query);
	}

	@Get("mangas/:id")
	@Public()
	@SerializeOptions({ schema: MangaSchema })
	get(@Param({ schema: MangaDetailsParamsSchema }) { id }: { id: string }) {
		return this.service.get(id);
	}

	// the manga, with an optional first reading
	@Post("mangas")
	@SerializeOptions({ schema: SaveResponseSchema })
	create(@Body({ schema: SaveBodyRequestSchema }) body: SaveBodyRequestType) {
		return this.service.create(body);
	}

	@Put("mangas/:id")
	@SerializeOptions({ schema: SaveResponseSchema })
	update(
		@Param({ schema: MangaDetailsParamsSchema }) { id }: { id: string },
		@Body({ schema: SaveBodyRequestSchema }) body: SaveBodyRequestType,
	) {
		return this.service.update(id, body);
	}

	@Post("mangas/:id/readings")
	@SerializeOptions({ schema: ReadingSchema })
	createReading(
		@Param({ schema: MangaDetailsParamsSchema }) { id }: { id: string },
		@Body({ schema: SaveReadingBodyRequestSchema }) reading: SaveReadingBodyRequestType,
	) {
		return this.service.createReading(id, reading);
	}

	@Put("mangas/:id/readings/:readingId")
	@SerializeOptions({ schema: ReadingSchema })
	updateReading(
		@Param({ schema: DeleteReadingParamsRequestSchema }) { id, readingId }: { id: string; readingId: string },
		@Body({ schema: SaveReadingBodyRequestSchema }) reading: SaveReadingBodyRequestType,
	) {
		return this.service.updateReading(id, readingId, reading);
	}

	@Delete("mangas/:id/readings/:readingId")
	@HttpCode(204)
	async deleteReading(
		@Param({ schema: DeleteReadingParamsRequestSchema }) { id, readingId }: { id: string; readingId: string },
	) {
		await this.service.deleteReading(id, readingId);
	}
}
