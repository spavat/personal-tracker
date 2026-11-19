import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
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
	SaveEpisodeBodyRequestSchema,
	type SaveEpisodeBodyRequestType,
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

	// the program, with an optional first episode
	@Post("programs")
	createProgram(@Body({ schema: SaveBodyRequestSchema }) body: SaveBodyRequestType) {
		return this.service.createProgram(body);
	}

	@Put("programs/:programId")
	updateProgram(
		@Param({ schema: DetailsProgramParamsRequestSchema }) { programId }: { programId: string },
		@Body({ schema: SaveBodyRequestSchema }) body: SaveBodyRequestType,
	) {
		return this.service.updateProgram(programId, body);
	}

	@Post("programs/:programId/episodes")
	createEpisode(
		@Param({ schema: DetailsProgramParamsRequestSchema }) { programId }: { programId: string },
		@Body({ schema: SaveEpisodeBodyRequestSchema }) episode: SaveEpisodeBodyRequestType,
	) {
		return this.service.createEpisode(programId, episode);
	}

	@Put("programs/:programId/episodes/:episodeId")
	updateEpisode(
		@Param({ schema: DeleteParamsRequestSchema }) { programId, episodeId }: DeleteParamsRequest,
		@Body({ schema: SaveEpisodeBodyRequestSchema }) episode: SaveEpisodeBodyRequestType,
	) {
		return this.service.updateEpisode(programId, episodeId, episode);
	}

	@Delete("programs/:programId/episodes/:episodeId")
	@HttpCode(204)
	async deleteEpisode(@Param({ schema: DeleteParamsRequestSchema }) { programId, episodeId }: DeleteParamsRequest) {
		await this.service.deleteEpisode(programId, episodeId);
	}
}
