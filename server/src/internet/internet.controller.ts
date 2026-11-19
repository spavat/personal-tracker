import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	type DeleteParamsRequest,
	DeleteParamsRequestSchema,
	DetailsProgramParamsRequestSchema,
	EpisodeListQuerystringRequestSchema,
	EpisodeListResponseSchema,
	EpisodeSchema,
	type ExtractQuerystringRequest,
	ExtractQuerystringRequestSchema,
	ProgramDetailsSchema,
	ProgramListQuerystringRequestSchema,
	ProgramListResponseSchema,
	SaveBodyRequestSchema,
	type SaveBodyRequestType,
	SaveEpisodeBodyRequestSchema,
	type SaveEpisodeBodyRequestType,
	SyncCoversResponseSchema,
} from "@personal-tracker/shared/internet";

import { Public } from "../auth/public.decorator.js";
import { type EpisodeListQuery, InternetService, type ProgramListQuery } from "./internet.service.js";

// Mounted at /internet by InternetModule's RouterModule path
@Controller()
export class InternetController {
	constructor(private readonly service: InternetService) {}

	@Get("programs")
	@Public()
	@SerializeOptions({ schema: ProgramListResponseSchema.element })
	listPrograms(@Query({ schema: ProgramListQuerystringRequestSchema }) query: ProgramListQuery) {
		return this.service.listPrograms(query);
	}

	@Get("episodes")
	@Public()
	@SerializeOptions({ schema: EpisodeListResponseSchema.element })
	listEpisodes(@Query({ schema: EpisodeListQuerystringRequestSchema }) query: EpisodeListQuery) {
		return this.service.listEpisodes(query);
	}

	@Get("programs/:programId")
	@Public()
	@SerializeOptions({ schema: ProgramDetailsSchema })
	getProgram(@Param({ schema: DetailsProgramParamsRequestSchema }) { programId }: { programId: string }) {
		return this.service.getProgram(programId);
	}

	@Get("extract")
	extract(@Query({ schema: ExtractQuerystringRequestSchema }) query: ExtractQuerystringRequest) {
		return this.service.extract(query);
	}

	@Post("sync-covers")
	@HttpCode(200)
	@SerializeOptions({ schema: SyncCoversResponseSchema })
	syncCovers() {
		return this.service.syncCovers();
	}

	// the program, with an optional first episode
	@Post("programs")
	@SerializeOptions({ schema: ProgramDetailsSchema })
	createProgram(@Body({ schema: SaveBodyRequestSchema }) body: SaveBodyRequestType) {
		return this.service.createProgram(body);
	}

	@Put("programs/:programId")
	@SerializeOptions({ schema: ProgramDetailsSchema })
	updateProgram(
		@Param({ schema: DetailsProgramParamsRequestSchema }) { programId }: { programId: string },
		@Body({ schema: SaveBodyRequestSchema }) body: SaveBodyRequestType,
	) {
		return this.service.updateProgram(programId, body);
	}

	@Post("programs/:programId/episodes")
	@SerializeOptions({ schema: EpisodeSchema })
	createEpisode(
		@Param({ schema: DetailsProgramParamsRequestSchema }) { programId }: { programId: string },
		@Body({ schema: SaveEpisodeBodyRequestSchema }) episode: SaveEpisodeBodyRequestType,
	) {
		return this.service.createEpisode(programId, episode);
	}

	@Put("programs/:programId/episodes/:episodeId")
	@SerializeOptions({ schema: EpisodeSchema })
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
