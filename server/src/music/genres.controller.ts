import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { DeleteGenreParamsRequestSchema, SaveGenreRequestSchema } from "@personal-tracker/shared/music";

import { GenresService } from "./genres.service.js";

@Controller("music/genres")
export class GenresController {
	constructor(private readonly service: GenresService) {}

	@Get()
	list() {
		return this.service.list();
	}

	@Post("save")
	@HttpCode(200)
	save(@Body({ schema: SaveGenreRequestSchema }) body: z.infer<typeof SaveGenreRequestSchema>) {
		return this.service.save(body);
	}

	@Delete(":id")
	delete(@Param({ schema: DeleteGenreParamsRequestSchema }) { id }: { id: string }) {
		return this.service.delete(id);
	}
}
