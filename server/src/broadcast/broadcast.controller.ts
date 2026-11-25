import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	CreateEpisodeBodyRequestSchema,
	type CreateEpisodeBodyRequestType,
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
	SaveFormatsBodyRequestSchema,
	type SaveFormatsBodyRequestType,
	SaveSeasonsBodyRequestSchema,
	type SaveSeasonsBodyRequestType,
	SeasonListResponseSchema,
	FormatListResponseSchema,
	EpisodeStatusBodyRequestSchema,
	type EpisodeStatusBodyRequest,
	ImportBodyRequestSchema,
	type ImportBodyRequest,
	ImportResponseSchema,
	SaveViewBodyRequestSchema,
	type SaveViewBodyRequestType,
	SyncCoversResponseSchema,
	type ViewParamsRequest,
	ViewParamsRequestSchema,
	ViewSchema,
} from "@personal-tracker/shared/broadcast";

import { Public } from "../auth/public.decorator.js";
import { type EpisodeListQuery, BroadcastService, type ProgramListQuery } from "./broadcast.service.js";

// Mounted at /broadcast by BroadcastModule's RouterModule path
@Controller()
export class BroadcastController {
	constructor(private readonly service: BroadcastService) {}

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

	@Put("programs/:programId/seasons")
	@SerializeOptions({ schema: SeasonListResponseSchema.element })
	saveSeasons(
		@Param({ schema: DetailsProgramParamsRequestSchema }) { programId }: { programId: string },
		@Body({ schema: SaveSeasonsBodyRequestSchema }) body: SaveSeasonsBodyRequestType,
	) {
		return this.service.saveSeasons(programId, body);
	}

	@Put("programs/:programId/formats")
	@SerializeOptions({ schema: FormatListResponseSchema.element })
	saveFormats(
		@Param({ schema: DetailsProgramParamsRequestSchema }) { programId }: { programId: string },
		@Body({ schema: SaveFormatsBodyRequestSchema }) body: SaveFormatsBodyRequestType,
	) {
		return this.service.saveFormats(programId, body);
	}

	// a catalog: every release of the program's source; a feed: its stored episodes completed
	@Post("programs/:programId/import")
	@HttpCode(200)
	@SerializeOptions({ schema: ImportResponseSchema })
	importCatalog(
		@Param({ schema: DetailsProgramParamsRequestSchema }) { programId }: { programId: string },
		@Body({ schema: ImportBodyRequestSchema }) body: ImportBodyRequest,
	) {
		return this.service.importCatalog(programId, body);
	}

	@Put("programs/:programId/episodes/:episodeId/status")
	@HttpCode(204)
	setEpisodeStatus(
		@Param({ schema: DeleteParamsRequestSchema }) { programId, episodeId }: DeleteParamsRequest,
		@Body({ schema: EpisodeStatusBodyRequestSchema }) body: EpisodeStatusBodyRequest,
	) {
		return this.service.setEpisodeStatus(programId, episodeId, body);
	}

	@Post("programs/:programId/episodes")
	@SerializeOptions({ schema: EpisodeSchema })
	createEpisode(
		@Param({ schema: DetailsProgramParamsRequestSchema }) { programId }: { programId: string },
		@Body({ schema: CreateEpisodeBodyRequestSchema }) episode: CreateEpisodeBodyRequestType,
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

	@Post("programs/:programId/episodes/:episodeId/views")
	@SerializeOptions({ schema: ViewSchema })
	createView(
		@Param({ schema: DeleteParamsRequestSchema }) { programId, episodeId }: DeleteParamsRequest,
		@Body({ schema: SaveViewBodyRequestSchema }) view: SaveViewBodyRequestType,
	) {
		return this.service.createView(programId, episodeId, view);
	}

	@Put("programs/:programId/episodes/:episodeId/views/:viewId")
	@SerializeOptions({ schema: ViewSchema })
	updateView(
		@Param({ schema: ViewParamsRequestSchema }) { programId, episodeId, viewId }: ViewParamsRequest,
		@Body({ schema: SaveViewBodyRequestSchema }) view: SaveViewBodyRequestType,
	) {
		return this.service.updateView(programId, episodeId, viewId, view);
	}

	// the episode goes too when it was its last view
	@Delete("programs/:programId/episodes/:episodeId/views/:viewId")
	@HttpCode(204)
	async deleteView(@Param({ schema: ViewParamsRequestSchema }) { programId, episodeId, viewId }: ViewParamsRequest) {
		await this.service.deleteView(programId, episodeId, viewId);
	}
}
