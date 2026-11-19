import type { MusicGenre } from "@personal-tracker/shared/music";

import { Injectable, Logger } from "@nestjs/common";

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

	save({ id, ...data }: Omit<MusicGenre, "id"> & { id?: string }) {
		this.logger.log("save");
		if (id) {
			return this.repo.update(id, data);
		}
		return this.repo.insert(buildGenre(data));
	}

	delete(id: string) {
		this.logger.log("delete");
		return this.repo.delete(id);
	}
}
