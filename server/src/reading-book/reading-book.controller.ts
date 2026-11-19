import type { ServerResponse } from "node:http";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Res, SerializeOptions } from "@nestjs/common";
import {
	AuthorListResponseSchema,
	AuthorParamsRequestSchema,
	BookDetailsParamsSchema,
	BookListRequestSchema,
	DeleteReadingParamsRequestSchema,
	EditionParamsRequestSchema,
	GetReportQuerystringRequestSchema,
	GetReportResponseSchema,
	ModelParamsRequestSchema,
	ReadingParamsRequestSchema,
	type SaveBookModelRequest,
	SaveBookModelRequestSchema,
	SaveBookRequestSchema,
	type SaveEditionRequest,
	SaveEditionRequestSchema,
	SaveReadingRequestSchema,
	type SaveSeriesRequest,
	SaveSeriesRequestSchema,
	SeriesListResponseSchema,
	SeriesParamsRequestSchema,
} from "@personal-tracker/shared/reading-book";

import { Public } from "../auth/public.decorator.js";
import {
	type BookListQuery,
	ReadingBookService,
	type SaveBookBody,
	type SaveReadingBody,
} from "./reading-book.service.js";

type IdParams = { id: string };

// The writes on a book's parts answer 204 (no body), as the Fastify routes did
@Controller("reading-book")
export class ReadingBookController {
	constructor(private readonly service: ReadingBookService) {}

	// --- series (public, like the books) ---

	@Get("series")
	@Public()
	@SerializeOptions({ schema: SeriesListResponseSchema.element })
	listSeries() {
		return this.service.listSeries();
	}

	@Get("series/:id")
	@Public()
	getSeries(@Param({ schema: SeriesParamsRequestSchema }) { id }: IdParams) {
		return this.service.getSeries(id);
	}

	// 201 on create, 200 on update: the status depends on the body. `passthrough` sets the status on the
	// response and lets Nest send the returned value as usual.
	@Post("series/save")
	saveSeries(
		@Body({ schema: SaveSeriesRequestSchema }) series: SaveSeriesRequest,
		@Res({ passthrough: true }) response: ServerResponse,
	) {
		response.statusCode = series.id ? 200 : 201;
		return this.service.saveSeries(series);
	}

	@Delete("series/:id")
	@HttpCode(204)
	async deleteSeries(@Param({ schema: SeriesParamsRequestSchema }) { id }: IdParams) {
		await this.service.deleteSeries(id);
	}

	// --- authors (public, like the books) ---

	@Get("authors")
	@Public()
	@SerializeOptions({ schema: AuthorListResponseSchema.element })
	listAuthors() {
		return this.service.listAuthors();
	}

	@Get("authors/:id")
	@Public()
	getAuthor(@Param({ schema: AuthorParamsRequestSchema }) { id }: IdParams) {
		return this.service.getAuthor(id);
	}

	// --- books ---

	@Get("books")
	@Public()
	listBooks(@Query({ schema: BookListRequestSchema }) query: BookListQuery) {
		return this.service.listBooks(query);
	}

	@Get("books/:id")
	@Public()
	getBook(@Param({ schema: BookDetailsParamsSchema }) { id }: IdParams) {
		return this.service.getBook(id);
	}

	@Post("save")
	@HttpCode(200)
	saveBook(@Body({ schema: SaveBookRequestSchema }) book: SaveBookBody) {
		return this.service.saveBook(book);
	}

	@Post("books/:id/models/save")
	@HttpCode(204)
	async saveModel(
		@Param({ schema: ReadingParamsRequestSchema }) { id }: IdParams,
		@Body({ schema: SaveBookModelRequestSchema }) model: SaveBookModelRequest,
	) {
		await this.service.saveModel(id, model);
	}

	@Delete("books/:id/models/:modelId")
	@HttpCode(204)
	async deleteModel(@Param({ schema: ModelParamsRequestSchema }) { id, modelId }: { id: string; modelId: string }) {
		await this.service.deleteModel(id, modelId);
	}

	// the cover can be sent as a base64 data URI: within the 15mb JSON limit (body-parsers.ts)
	@Post("books/:id/editions/save")
	@HttpCode(204)
	async saveEdition(
		@Param({ schema: ReadingParamsRequestSchema }) { id }: IdParams,
		@Body({ schema: SaveEditionRequestSchema }) edition: SaveEditionRequest,
	) {
		await this.service.saveEdition(id, edition);
	}

	@Delete("books/:id/editions/:editionId")
	@HttpCode(204)
	async deleteEdition(
		@Param({ schema: EditionParamsRequestSchema }) { id, editionId }: { id: string; editionId: string },
	) {
		await this.service.deleteEdition(id, editionId);
	}

	@Post("books/:id/editions/:editionId/readings")
	@HttpCode(204)
	async addReading(
		@Param({ schema: EditionParamsRequestSchema }) { id, editionId }: { id: string; editionId: string },
	) {
		await this.service.addReading(id, editionId);
	}

	@Post("books/:id/saveReading")
	@HttpCode(204)
	async saveReading(
		@Param({ schema: ReadingParamsRequestSchema }) { id }: IdParams,
		@Body({ schema: SaveReadingRequestSchema }) reading: SaveReadingBody,
	) {
		await this.service.saveReading(id, reading);
	}

	@Delete("books/:id/readings/:readingId")
	@HttpCode(204)
	async deleteReading(
		@Param({ schema: DeleteReadingParamsRequestSchema }) { id, readingId }: { id: string; readingId: string },
	) {
		await this.service.deleteReading(id, readingId);
	}

	@Get("reports")
	@SerializeOptions({ schema: GetReportResponseSchema })
	report(@Query({ schema: GetReportQuerystringRequestSchema }) period: { from: string; to: string }) {
		return this.service.report(period);
	}
}
