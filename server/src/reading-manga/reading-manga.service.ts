import type {
	MangaListRequestSchema,
	Reading,
	SaveBodyRequestType,
	SaveReadingBodyRequestType,
} from "@personal-tracker/shared/reading-manga";
import type { z } from "zod";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { NotFoundError } from "../common/errors.js";
import { buildReading } from "./reading-manga.entity.js";
import { ReadingMangaRepository } from "./reading-manga.repository.js";

export type MangaListQuery = z.infer<typeof MangaListRequestSchema>;

@Injectable()
export class ReadingMangaService {
	private readonly logger = new Logger(ReadingMangaService.name);
	constructor(private readonly repo: ReadingMangaRepository) {}

	list({ sort, from, to, search, withReadings }: MangaListQuery) {
		this.logger.log("list");
		const [sortField, sortDirection] = sort ?? ["title", "asc"];
		return this.repo.findAll({ search, from, to, withReadings, sortField, sortDirection });
	}

	async get(id: string) {
		this.logger.log("get");
		return (await this.repo.findById(id)) ?? mangaNotFound();
	}

	// the manga (as GET /mangas/:id gives it), with an optional first reading
	async create({ manga: { id: _, ...manga }, reading }: SaveBodyRequestType) {
		this.logger.log("create");
		const id = randomUUID();
		await this.repo.insert({ id, ...manga, readings: reading ? [buildReading(reading)] : [] });
		return this.get(id);
	}

	// the manga's fields only: its readings have their own routes
	async update(id: string, { manga: { id: _, ...manga } }: SaveBodyRequestType) {
		this.logger.log("update");
		if (!(await this.repo.update(id, manga))) {
			mangaNotFound();
		}
		return this.get(id);
	}

	async createReading(mangaId: string, { id: _, ...fields }: SaveReadingBodyRequestType) {
		this.logger.log("createReading");
		const reading = buildReading(fields);
		if (!(await this.repo.pushReading(mangaId, reading))) {
			mangaNotFound();
		}
		return reading;
	}

	async updateReading(mangaId: string, readingId: string, { id: _, ...fields }: SaveReadingBodyRequestType) {
		this.logger.log("updateReading");
		if (!(await this.repo.updateReading(mangaId, { ...fields, id: readingId } as Reading))) {
			readingNotFound();
		}
		return (await this.repo.findById(mangaId))?.readings.find((r) => r.id === readingId) ?? readingNotFound();
	}

	async deleteReading(mangaId: string, readingId: string) {
		this.logger.log("deleteReading");
		if (!(await this.repo.deleteReading(mangaId, readingId))) {
			readingNotFound();
		}
	}
}

function mangaNotFound(): never {
	throw new NotFoundError("Manga introuvable");
}

function readingNotFound(): never {
	throw new NotFoundError("Lecture introuvable");
}
