import type { MangaListRequestSchema, Reading, SaveBodyRequestType } from "@personal-tracker/shared/reading-manga";
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
		const manga = await this.repo.findById(id);
		if (!manga) {
			throw new NotFoundError("Manga introuvable");
		}
		return manga;
	}

	async save({ manga, reading, mangaId }: SaveBodyRequestType) {
		this.logger.log("save");
		let returnMangaId = "";
		if (manga) {
			const { id, ...mangaData } = manga;
			if (id) {
				// Update existing manga
				returnMangaId = id;
				await this.repo.update(id, manga);
			} else {
				// Add new manga
				returnMangaId = randomUUID();
				await this.repo.insert({
					id: returnMangaId,
					...mangaData,
					readings: reading ? [buildReading(reading)] : [],
				});
			}
		} else if (reading && mangaId) {
			returnMangaId = mangaId;
			if (reading.id) {
				// Update existing reading
				await this.repo.updateReading(mangaId, reading as Reading);
			} else {
				// Add new reading to existing manga
				await this.repo.pushReading(mangaId, buildReading(reading));
			}
		}

		return this.repo.findById(returnMangaId);
	}

	deleteReading(mangaId: string, readingId: string) {
		this.logger.log("deleteReading");
		return this.repo.deleteReading(mangaId, readingId);
	}
}
