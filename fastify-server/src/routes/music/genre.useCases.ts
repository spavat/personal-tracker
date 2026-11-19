import type { MusicGenre } from "@personal-tracker/shared/music";
import type { FastifyBaseLogger } from "fastify";

import type { GenreRepository } from "./genre.repository";

import { buildGenre } from "./genre.entity";

export class ListGenresUseCase {
	constructor(private repo: GenreRepository) {}

	execute(log: FastifyBaseLogger) {
		log.info("ListGenresUseCase.execute");
		return this.repo.findAll();
	}
}

export class CreateGenreUseCase {
	constructor(private repo: GenreRepository) {}

	execute(input: Omit<MusicGenre, "id">, log: FastifyBaseLogger) {
		log.info("CreateGenreUseCase.execute");
		return this.repo.insert(buildGenre(input));
	}
}

export class UpdateGenreUseCase {
	constructor(private repo: GenreRepository) {}

	execute({ id, input }: { id: string; input: Partial<MusicGenre> }, log: FastifyBaseLogger) {
		log.info("UpdateGenreUseCase.execute");
		return this.repo.update(id, input);
	}
}

export class DeleteGenreUseCase {
	constructor(private repo: GenreRepository) {}

	execute(id: string, log: FastifyBaseLogger) {
		log.info("DeleteGenreUseCase.execute");
		return this.repo.delete(id);
	}
}
