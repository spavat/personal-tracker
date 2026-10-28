import type {
	BookListRequestSchema,
	GetReportResponse,
	SaveBookRequestSchema,
	SaveModelBodyRequestSchema,
	SaveReadingRequestSchema,
} from "@personal-tracker/shared/reading-book";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";

import { randomUUID } from "crypto";

import type { ContextTagRepository } from "../context-tags/context-tag.repository";
import type { BookRepository } from "./book.repository";

import { buildInitialReading, getLongestConsecutiveStreak, median } from "./book.entity";

type BookListQuery = z.infer<typeof BookListRequestSchema>;
type SaveBookBody = z.infer<typeof SaveBookRequestSchema>;
type SaveModelBody = z.infer<typeof SaveModelBodyRequestSchema>;
type SaveReadingBody = z.infer<typeof SaveReadingRequestSchema>;

function isDateBetween(dateStr: string, fromStr: string, toStr: string) {
	return dateStr >= fromStr && dateStr <= toStr;
}

export class ListBooksUseCase {
	constructor(private repo: BookRepository) {}

	execute({ sort, from, to, withReadingsDetails }: BookListQuery, log: FastifyBaseLogger) {
		log.info("ListBooksUseCase.execute");
		const [sortField, sortDirection] = sort ?? ["lastReadDate", "desc"];
		return this.repo.findAll({ from, to, withReadingsDetails, sortField, sortDirection });
	}
}

export class GetBookUseCase {
	constructor(private repo: BookRepository) {}

	execute(id: string, log: FastifyBaseLogger) {
		log.info("GetBookUseCase.execute");
		return this.repo.findById(id);
	}
}

export class SaveBookUseCase {
	constructor(private repo: BookRepository) {}

	async execute(book: SaveBookBody, log: FastifyBaseLogger) {
		log.info("SaveBookUseCase.execute");
		let bookId = book.id;
		if (bookId) {
			await this.repo.update(bookId, book);
		} else {
			bookId = randomUUID();
			await this.repo.insert({ id: bookId, ...book, readings: [], model: [] });
		}
		return this.repo.findById(bookId);
	}
}

export class SaveModelUseCase {
	constructor(private repo: BookRepository) {}

	execute({ bookId, model }: { bookId: string; model: SaveModelBody }, log: FastifyBaseLogger) {
		log.info("SaveModelUseCase.execute");
		if (!bookId) {
			throw new Error("Book ID is required");
		}
		return this.repo.updateModel(bookId, model);
	}
}

export class AddReadingUseCase {
	constructor(private repo: BookRepository) {}

	execute(bookId: string, log: FastifyBaseLogger) {
		log.info("AddReadingUseCase.execute");
		if (!bookId) {
			throw new Error("Book ID is required");
		}
		return this.repo.pushReading(bookId, buildInitialReading());
	}
}

export class SaveReadingUseCase {
	constructor(private repo: BookRepository) {}

	execute({ bookId, reading }: { bookId: string; reading: SaveReadingBody }, log: FastifyBaseLogger) {
		log.info("SaveReadingUseCase.execute");
		if (!bookId) {
			throw new Error("Book ID is required");
		}
		return this.repo.updateReading(bookId, reading);
	}
}

export class DeleteReadingUseCase {
	constructor(private repo: BookRepository) {}

	execute({ bookId, readingId }: { bookId: string; readingId: string }, log: FastifyBaseLogger) {
		log.info("DeleteReadingUseCase.execute");
		if (!readingId) {
			throw new Error("Reading ID is required");
		}
		return this.repo.deleteReading(bookId, readingId);
	}
}

export class GetReportUseCase {
	constructor(
		private repo: BookRepository,
		private contextTagRepo: ContextTagRepository,
	) {}

	async execute({ from, to }: { from: string; to: string }, log: FastifyBaseLogger): Promise<GetReportResponse> {
		log.info("GetReportUseCase.execute");
		const books = await this.repo.findAll({
			from,
			to,
			withReadingsDetails: true,
			sortField: "name",
			sortDirection: "asc",
		});

		const contextTagGroups = (await this.contextTagRepo.findAll()) ?? [];
		const mapTags: Record<string, string> = {};
		for (const group of contextTagGroups) {
			for (const tag of group.tags) {
				mapTags[tag] = group.name;
			}
		}

		let totalChapters = 0;
		const allDates = new Set<string>();
		const statusDistribution: Record<string, any> = {};
		const tagDistribution: Record<string, number> = {};
		const langDistribution: Record<string, number> = {};
		const authorDistribution: Record<string, any> = {};
		for (let book of books ?? []) {
			const authors = Array.isArray(book.author) ? book.author : [book.author];
			for (let reading of book.readings) {
				// Status distribution
				const status =
					reading.status === "complete" && !isDateBetween(reading.lastReadDate, from, to)
						? "in-progress" // Completed after the selected period, considered in-progress
						: reading.status;
				if (!statusDistribution[status]) {
					statusDistribution[status] = [];
				}
				statusDistribution[status].push(reading.readingDates.length);

				authors.forEach((author) => {
					if (!authorDistribution[author]) {
						authorDistribution[author] = {
							books: 0,
							chapters: 0,
							differentDays: new Set(),
						};
					}
					if (status === "complete") {
						authorDistribution[author].books++;
					}
				});

				for (let detail of reading.details) {
					const dates: Array<string> = [];
					dates.push(...detail.context.map(({ date }: { date: string }) => date));
					const datesThisYear = dates.filter((date) => isDateBetween(date, from, to));
					if (datesThisYear.length) {
						totalChapters++;
						for (let date of datesThisYear) {
							allDates.add(date);
						}

						// Group by tag (each tag group counts once per chapter)
						const chapterTags = new Set<string>();
						detail.context.forEach(({ tags }: { tags: Array<string> }) => {
							tags.forEach((tag) => {
								chapterTags.add(mapTags[tag] ?? tag);
							});
						});
						chapterTags.forEach((mainTag) => {
							if (!tagDistribution[mainTag]) {
								tagDistribution[mainTag] = 0;
							}
							tagDistribution[mainTag]++;
						});

						// Group by language
						if (!langDistribution[book.language]) {
							langDistribution[book.language] = 0;
						}
						langDistribution[book.language]++;

						// Group by author
						authors.forEach((author) => {
							authorDistribution[author].chapters++;
							datesThisYear.forEach((date) => {
								authorDistribution[author].differentDays.add(date);
							});
						});
					}
				}
			}
		}

		const streakInfo = getLongestConsecutiveStreak(Array.from(allDates));

		return {
			hasData: Array.isArray(books) && books.length > 0,
			streakInfo,
			statusDistribution: Object.entries(statusDistribution)
				.map(([key, values]) => ({
					name: key,
					books: values.length,
					averageDays: Math.round(
						values.reduce((acc: number, number: number) => acc + number, 0) / values.length,
					),
					medianDays: median(values),
				}))
				.toSorted((a, b) => b.books - a.books),
			tagDistribution: Object.entries(tagDistribution)
				.map(([key, count]) => ({
					name: key,
					chapters: count,
					percent: Math.round((count / totalChapters) * 100),
				}))
				.toSorted((a, b) => b.chapters - a.chapters),
			langDistribution: Object.entries(langDistribution)
				.map(([key, count]) => ({
					name: key,
					chapters: count,
					percent: Math.round((count / totalChapters) * 100),
				}))
				.toSorted((a, b) => b.chapters - a.chapters),
			authorDistribution: Object.entries(authorDistribution)
				.map(([key, values]) => ({
					name: key,
					books: values.books,
					chapters: values.chapters,
					days: values.differentDays.size,
				}))
				.toSorted((a, b) => {
					if (b.books !== a.books) {
						return b.books - a.books;
					}
					return b.chapters - a.chapters;
				}),
		};
	}
}
