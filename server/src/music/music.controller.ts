import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	DeleteParamsRequestSchema,
	DetailsParamsRequestSchema,
	DetailsResponseSchema,
	FortnightStatsResponseSchema,
	GetReportQuerystringRequestSchema,
	GetReportResponseSchema,
	ListQuerystringRequestSchema,
	ListResponseSchema,
	SaveBodyRequestSchema,
	SearchQuerystringRequestSchema,
	SearchResponseSchema,
	StatsQuerystringRequestSchema,
	StatsResponseSchema,
} from "@personal-tracker/shared/music";

import { Public } from "../auth/public.decorator.js";
import { MusicStatsService } from "./music-stats.service.js";
import { MusicService, type SaveListeningBody } from "./music.service.js";

type Period = { from: string; to: string };

// The serializer validates an array response item by item: array routes get the item schema (`.element`)
@Controller("music")
export class MusicController {
	constructor(
		private readonly service: MusicService,
		private readonly stats: MusicStatsService,
	) {}

	@Get("listenings")
	@Public()
	@SerializeOptions({ schema: ListResponseSchema.element })
	list(@Query({ schema: ListQuerystringRequestSchema }) query: z.infer<typeof ListQuerystringRequestSchema>) {
		return this.service.list(query);
	}

	@Get("search")
	@Public()
	@SerializeOptions({ schema: SearchResponseSchema.element })
	search(
		@Query({ schema: SearchQuerystringRequestSchema }) { search }: z.infer<typeof SearchQuerystringRequestSchema>,
	) {
		return this.service.search(search);
	}

	@Get("listenings/:id")
	@Public()
	@SerializeOptions({ schema: DetailsResponseSchema })
	get(@Param({ schema: DetailsParamsRequestSchema }) { id }: { id: string }) {
		return this.service.get(id);
	}

	@Post("listenings")
	@SerializeOptions({ schema: DetailsResponseSchema })
	create(@Body({ schema: SaveBodyRequestSchema }) body: SaveListeningBody) {
		return this.service.create(body);
	}

	@Put("listenings/:id")
	@SerializeOptions({ schema: DetailsResponseSchema })
	update(
		@Param({ schema: DeleteParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: SaveBodyRequestSchema }) body: SaveListeningBody,
	) {
		return this.service.update(id, body);
	}

	@Delete("listenings/:id")
	@HttpCode(204)
	async delete(@Param({ schema: DeleteParamsRequestSchema }) { id }: { id: string }) {
		await this.service.delete(id);
	}

	@Get("stats")
	@Public()
	@SerializeOptions({ schema: StatsResponseSchema })
	getStats(@Query({ schema: StatsQuerystringRequestSchema }) query: Period) {
		return this.stats.stats(query);
	}

	@Get("stats/fortnight")
	@Public()
	@SerializeOptions({ schema: FortnightStatsResponseSchema.element })
	fortnightStats() {
		return this.stats.fortnightStats();
	}

	@Get("reports")
	@SerializeOptions({ schema: GetReportResponseSchema })
	report(@Query({ schema: GetReportQuerystringRequestSchema }) query: Period) {
		return this.stats.report(query);
	}
}
