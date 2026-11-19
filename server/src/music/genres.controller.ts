import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, SerializeOptions } from "@nestjs/common";
import {
	DeleteGenreParamsRequestSchema,
	MusicGenreSchema,
	SaveGenreRequestSchema,
} from "@personal-tracker/shared/music";

import { GenresService } from "./genres.service.js";

@Controller("music/genres")
export class GenresController {
	constructor(private readonly service: GenresService) {}

	@Get()
	list() {
		return this.service.list();
	}

	@Post()
	@SerializeOptions({ schema: MusicGenreSchema })
	create(@Body({ schema: SaveGenreRequestSchema }) body: z.infer<typeof SaveGenreRequestSchema>) {
		return this.service.create(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: MusicGenreSchema })
	update(
		@Param({ schema: DeleteGenreParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: SaveGenreRequestSchema }) body: z.infer<typeof SaveGenreRequestSchema>,
	) {
		return this.service.update(id, body);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: DeleteGenreParamsRequestSchema }) { id }: { id: string }) {
		await this.service.delete(id);
	}
}
