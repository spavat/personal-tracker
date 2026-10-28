import type { MangaListRequestSchema, Reading, SaveBodyRequestType } from "@personal-tracker/shared/reading-manga";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";

import { randomUUID } from "crypto";

import type { MangaRepository } from "./manga.repository";

import { buildReading } from "./manga.entity";

type MangaListQuery = z.infer<typeof MangaListRequestSchema>;

export class ListMangasUseCase {
	constructor(private repo: MangaRepository) {}

	execute({ sort, from, to, search, withReadings }: MangaListQuery, log: FastifyBaseLogger) {
		log.info("ListMangasUseCase.execute");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		return this.repo.findAll({ search, from, to, withReadings, sortField, sortDirection });
	}
}

export class GetMangaUseCase {
	constructor(private repo: MangaRepository) {}

	execute(id: string, log: FastifyBaseLogger) {
		log.info("GetMangaUseCase.execute");
		return this.repo.findById(id);
	}
}

export class SaveMangaUseCase {
	constructor(private repo: MangaRepository) {}

	async execute({ manga, reading, mangaId }: SaveBodyRequestType, log: FastifyBaseLogger) {
		log.info("SaveMangaUseCase.execute");
		if (mangaId && manga?.id) {
			throw new Error("Cannot provide both mangaId and manga.id");
		}

		let returnMangaId = "";
		if (manga) {
			const { id, ...mangaData } = manga;
			if (manga.id) {
				// Update existing manga
				returnMangaId = manga.id;
				await this.repo.update(manga.id, manga);
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
		} else {
			return { error: "Nothing to do" };
		}

		return this.repo.findById(returnMangaId);
	}
}

export class DeleteReadingUseCase {
	constructor(private repo: MangaRepository) {}

	execute({ mangaId, readingId }: { mangaId: string; readingId: string }, log: FastifyBaseLogger) {
		log.info("DeleteReadingUseCase.execute");
		if (!readingId) {
			throw new Error("Reading ID is required");
		}
		return this.repo.deleteReading(mangaId, readingId);
	}
}
