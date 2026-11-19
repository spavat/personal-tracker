import type { MusicGenre } from "@personal-tracker/shared/music";

import { Injectable, Logger } from "@nestjs/common";

import { NotFoundError } from "../common/errors.js";
import { buildGenre } from "./genre.entity.js";
import { GenresRepository } from "./genres.repository.js";

@Injectable()
export class GenresService {
	private readonly logger = new Logger(GenresService.name);
	constructor(private readonly repo: GenresRepository) {}

	list() {
		this.logger.log("list");
		return this.repo.findAll();
	}

	create(data: Omit<MusicGenre, "id">) {
		this.logger.log("create");
		return this.repo.insert(buildGenre(data));
	}

	async update(id: string, data: Omit<MusicGenre, "id">) {
		this.logger.log("update");
		return (await this.repo.update(id, data)) ?? notFound();
	}

	async delete(id: string) {
		this.logger.log("delete");
		if (!(await this.repo.delete(id))) {
			notFound();
		}
	}
}

function notFound(): never {
	throw new NotFoundError("genre");
}
