import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	AuthorDetailsSchema,
	AuthorListResponseSchema,
	AuthorParamsRequestSchema,
	BookDetailsParamsSchema,
	BookListRequestSchema,
	BookListResponseSchema,
	BookModelSchema,
	BookSchema,
	DeleteReadingParamsRequestSchema,
	EditionParamsRequestSchema,
	EditionSchema,
	GetReportQuerystringRequestSchema,
	GetReportResponseSchema,
	ModelParamsRequestSchema,
	ReadingParamsRequestSchema,
	ReadingSchema,
	type SaveBookModelRequest,
	SaveBookModelRequestSchema,
	SaveBookRequestSchema,
	type SaveEditionRequest,
	SaveEditionRequestSchema,
	SaveReadingRequestSchema,
	type SaveSeriesRequest,
	SaveSeriesRequestSchema,
	SeriesDetailsSchema,
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
	@SerializeOptions({ schema: SeriesDetailsSchema })
	getSeries(@Param({ schema: SeriesParamsRequestSchema }) { id }: IdParams) {
		return this.service.getSeries(id);
	}

	@Post("series")
	@SerializeOptions({ schema: SeriesDetailsSchema })
	createSeries(@Body({ schema: SaveSeriesRequestSchema }) series: SaveSeriesRequest) {
		return this.service.saveSeries({ ...series, id: undefined });
	}

	@Put("series/:id")
	@SerializeOptions({ schema: SeriesDetailsSchema })
	updateSeries(
		@Param({ schema: SeriesParamsRequestSchema }) { id }: IdParams,
		@Body({ schema: SaveSeriesRequestSchema }) series: SaveSeriesRequest,
	) {
		return this.service.saveSeries({ ...series, id });
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
	@SerializeOptions({ schema: AuthorDetailsSchema })
	getAuthor(@Param({ schema: AuthorParamsRequestSchema }) { id }: IdParams) {
		return this.service.getAuthor(id);
	}

	// --- books ---

	@Get("books")
	@Public()
	@SerializeOptions({ schema: BookListResponseSchema.element })
	listBooks(@Query({ schema: BookListRequestSchema }) query: BookListQuery) {
		return this.service.listBooks(query);
	}

	@Get("books/:id")
	@Public()
	@SerializeOptions({ schema: BookSchema })
	getBook(@Param({ schema: BookDetailsParamsSchema }) { id }: IdParams) {
		return this.service.getBook(id);
	}

	@Post("books")
	@SerializeOptions({ schema: BookSchema })
	createBook(@Body({ schema: SaveBookRequestSchema }) book: SaveBookBody) {
		return this.service.saveBook({ ...book, id: undefined });
	}

	@Put("books/:id")
	@SerializeOptions({ schema: BookSchema })
	updateBook(
		@Param({ schema: BookDetailsParamsSchema }) { id }: IdParams,
		@Body({ schema: SaveBookRequestSchema }) book: SaveBookBody,
	) {
		return this.service.saveBook({ ...book, id });
	}

	@Post("books/:id/models")
	@SerializeOptions({ schema: BookModelSchema })
	createModel(
		@Param({ schema: ReadingParamsRequestSchema }) { id }: IdParams,
		@Body({ schema: SaveBookModelRequestSchema }) model: SaveBookModelRequest,
	) {
		return this.service.saveModel(id, { ...model, id: undefined });
	}

	@Put("books/:id/models/:modelId")
	@SerializeOptions({ schema: BookModelSchema })
	updateModel(
		@Param({ schema: ModelParamsRequestSchema }) { id, modelId }: { id: string; modelId: string },
		@Body({ schema: SaveBookModelRequestSchema }) model: SaveBookModelRequest,
	) {
		return this.service.saveModel(id, { ...model, id: modelId });
	}

	@Delete("books/:id/models/:modelId")
	@HttpCode(204)
	async deleteModel(@Param({ schema: ModelParamsRequestSchema }) { id, modelId }: { id: string; modelId: string }) {
		await this.service.deleteModel(id, modelId);
	}

	// the cover can be sent as a base64 data URI: within the 15mb JSON limit (body-parsers.ts)
	@Post("books/:id/editions")
	@SerializeOptions({ schema: EditionSchema })
	createEdition(
		@Param({ schema: ReadingParamsRequestSchema }) { id }: IdParams,
		@Body({ schema: SaveEditionRequestSchema }) edition: SaveEditionRequest,
	) {
		return this.service.saveEdition(id, { ...edition, id: undefined });
	}

	@Put("books/:id/editions/:editionId")
	@SerializeOptions({ schema: EditionSchema })
	updateEdition(
		@Param({ schema: EditionParamsRequestSchema }) { id, editionId }: { id: string; editionId: string },
		@Body({ schema: SaveEditionRequestSchema }) edition: SaveEditionRequest,
	) {
		return this.service.saveEdition(id, { ...edition, id: editionId });
	}

	@Delete("books/:id/editions/:editionId")
	@HttpCode(204)
	async deleteEdition(
		@Param({ schema: EditionParamsRequestSchema }) { id, editionId }: { id: string; editionId: string },
	) {
		await this.service.deleteEdition(id, editionId);
	}

	// a new reading of the edition, not started
	@Post("books/:id/editions/:editionId/readings")
	@SerializeOptions({ schema: ReadingSchema })
	addReading(@Param({ schema: EditionParamsRequestSchema }) { id, editionId }: { id: string; editionId: string }) {
		return this.service.addReading(id, editionId);
	}

	@Put("books/:id/readings/:readingId")
	@SerializeOptions({ schema: ReadingSchema })
	saveReading(
		@Param({ schema: DeleteReadingParamsRequestSchema }) { id, readingId }: { id: string; readingId: string },
		@Body({ schema: SaveReadingRequestSchema }) reading: SaveReadingBody,
	) {
		return this.service.saveReading(id, { ...reading, id: readingId });
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
