import type {
	BookListRequestSchema,
	SaveBookModelRequest,
	SaveBookRequestSchema,
	SaveEditionRequest,
	SaveReadingRequestSchema,
	SaveSeriesRequest,
} from "@personal-tracker/shared/reading-book";
import type { z } from "zod";

import { Injectable, Logger } from "@nestjs/common";

import { NotFoundError } from "../common/errors.js";
import { ContextTagsRepository } from "../context-tags/context-tags.repository.js";
import { BookRepository } from "./book.repository.js";
import {
	AddReadingUseCase,
	type BookLog,
	DeleteEditionUseCase,
	DeleteModelUseCase,
	DeleteReadingUseCase,
	DeleteSeriesUseCase,
	GetAuthorUseCase,
	GetBookUseCase,
	GetReportUseCase,
	GetSeriesUseCase,
	ListAuthorsUseCase,
	ListBooksUseCase,
	ListSeriesUseCase,
	SaveBookUseCase,
	SaveEditionUseCase,
	SaveModelUseCase,
	SaveReadingUseCase,
	SaveSeriesUseCase,
} from "./book.useCases.js";
import { CoverStorage } from "./cover.storage.js";

export type BookListQuery = z.infer<typeof BookListRequestSchema>;
export type SaveBookBody = z.infer<typeof SaveBookRequestSchema>;
export type SaveReadingBody = z.infer<typeof SaveReadingRequestSchema>;

/**
 * Books, editions, readings, series and authors. The rules live in framework-free use cases (book.useCases.ts,
 * tested with a fake repository); this provider wires them to the injected repositories and the cover storage.
 */
@Injectable()
export class ReadingBookService {
	private readonly logger = new Logger(ReadingBookService.name);
	private readonly log: BookLog = {
		info: (message) => this.logger.log(message),
		warn: (details, message) => this.logger.warn(`${message} ${JSON.stringify(details)}`),
	};
	private readonly useCases;

	constructor(repo: BookRepository, covers: CoverStorage, contextTags: ContextTagsRepository) {
		this.useCases = {
			listBooks: new ListBooksUseCase(repo),
			getBook: new GetBookUseCase(repo),
			saveBook: new SaveBookUseCase(repo),
			saveModel: new SaveModelUseCase(repo),
			deleteModel: new DeleteModelUseCase(repo),
			saveEdition: new SaveEditionUseCase(repo, covers),
			deleteEdition: new DeleteEditionUseCase(repo, covers),
			addReading: new AddReadingUseCase(repo),
			saveReading: new SaveReadingUseCase(repo),
			deleteReading: new DeleteReadingUseCase(repo),
			getReport: new GetReportUseCase(repo, contextTags),
			listSeries: new ListSeriesUseCase(repo),
			getSeries: new GetSeriesUseCase(repo),
			saveSeries: new SaveSeriesUseCase(repo),
			deleteSeries: new DeleteSeriesUseCase(repo),
			listAuthors: new ListAuthorsUseCase(repo),
			getAuthor: new GetAuthorUseCase(repo),
		};
	}

	listBooks(query: BookListQuery) {
		return this.useCases.listBooks.execute(query, this.log);
	}

	async getBook(id: string) {
		return (await this.useCases.getBook.execute(id, this.log)) ?? notFound("Livre introuvable");
	}

	saveBook(book: SaveBookBody) {
		return this.useCases.saveBook.execute(book, this.log);
	}

	saveModel(bookId: string, model: SaveBookModelRequest) {
		return this.useCases.saveModel.execute({ bookId, model }, this.log);
	}

	deleteModel(bookId: string, modelId: string) {
		return this.useCases.deleteModel.execute({ bookId, modelId }, this.log);
	}

	saveEdition(bookId: string, edition: SaveEditionRequest) {
		return this.useCases.saveEdition.execute({ bookId, edition }, this.log);
	}

	deleteEdition(bookId: string, editionId: string) {
		return this.useCases.deleteEdition.execute({ bookId, editionId }, this.log);
	}

	addReading(bookId: string, editionId: string) {
		return this.useCases.addReading.execute({ bookId, editionId }, this.log);
	}

	saveReading(bookId: string, reading: SaveReadingBody) {
		return this.useCases.saveReading.execute({ bookId, reading }, this.log);
	}

	deleteReading(bookId: string, readingId: string) {
		return this.useCases.deleteReading.execute({ bookId, readingId }, this.log);
	}

	report(period: { from: string; to: string }) {
		return this.useCases.getReport.execute(period, this.log);
	}

	listSeries() {
		return this.useCases.listSeries.execute(this.log);
	}

	async getSeries(id: string) {
		return (await this.useCases.getSeries.execute(id, this.log)) ?? notFound("Série introuvable");
	}

	saveSeries(series: SaveSeriesRequest) {
		return this.useCases.saveSeries.execute(series, this.log);
	}

	deleteSeries(id: string) {
		return this.useCases.deleteSeries.execute(id, this.log);
	}

	listAuthors() {
		return this.useCases.listAuthors.execute(this.log);
	}

	async getAuthor(id: string) {
		return (await this.useCases.getAuthor.execute(id, this.log)) ?? notFound("Auteur·ice introuvable");
	}
}

function notFound(message: string): never {
	throw new NotFoundError(message);
}
