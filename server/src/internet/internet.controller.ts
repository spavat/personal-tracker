import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import {
	DeleteParamsRequestSchema,
	type DeleteParamsRequest,
	DetailsProgramParamsRequestSchema,
	EpisodeListQuerystringRequestSchema,
	ExtractQuerystringRequestSchema,
	type ExtractQuerystringRequest,
	ProgramListQuerystringRequestSchema,
	SaveBodyRequestSchema,
	type SaveBodyRequestType,
} from "@personal-tracker/shared/internet";

import { Public } from "../auth/public.decorator.js";
import { type EpisodeListQuery, InternetService, type ProgramListQuery } from "./internet.service.js";

// Mounted at /internet by InternetModule's RouterModule path
@Controller()
export class InternetController {
	constructor(private readonly service: InternetService) {}

	@Get("programs")
	@Public()
	listPrograms(@Query({ schema: ProgramListQuerystringRequestSchema }) query: ProgramListQuery) {
		return this.service.listPrograms(query);
	}

	@Get("episodes")
	@Public()
	listEpisodes(@Query({ schema: EpisodeListQuerystringRequestSchema }) query: EpisodeListQuery) {
		return this.service.listEpisodes(query);
	}

	@Get("id/:programId")
	@Public()
	getProgram(@Param({ schema: DetailsProgramParamsRequestSchema }) { programId }: { programId: string }) {
		return this.service.getProgram(programId);
	}

	@Get("extract")
	extract(@Query({ schema: ExtractQuerystringRequestSchema }) query: ExtractQuerystringRequest) {
		return this.service.extract(query);
	}

	@Post("sync-covers")
	@HttpCode(200)
	syncCovers() {
		return this.service.syncCovers();
	}

	@Post("save")
	@HttpCode(200)
	save(@Body({ schema: SaveBodyRequestSchema }) body: SaveBodyRequestType) {
		return this.service.save(body);
	}

	@Delete("programs/:programId/episodes/:episodeId")
	deleteEpisode(@Param({ schema: DeleteParamsRequestSchema }) { programId, episodeId }: DeleteParamsRequest) {
		return this.service.deleteEpisode(programId, episodeId);
	}
}
