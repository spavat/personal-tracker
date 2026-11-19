import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, SerializeOptions } from "@nestjs/common";
import {
	DeleteParamsRequestSchema,
	DetailsQuerystringRequestSchema,
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

	@Get("list")
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

	@Get("id")
	@Public()
	@SerializeOptions({ schema: DetailsResponseSchema })
	get(@Query({ schema: DetailsQuerystringRequestSchema }) { id }: { id: string }) {
		return this.service.get(id);
	}

	@Post("save")
	@HttpCode(200)
	save(@Body({ schema: SaveBodyRequestSchema }) body: SaveListeningBody) {
		return this.service.save(body);
	}

	@Delete(":id")
	delete(@Param({ schema: DeleteParamsRequestSchema }) { id }: { id: string }) {
		return this.service.delete(id);
	}

	@Get("stats")
	@Public()
	@SerializeOptions({ schema: StatsResponseSchema })
	getStats(@Query({ schema: StatsQuerystringRequestSchema }) query: Period) {
		return this.stats.stats(query);
	}

	@Get("fortnight-stats")
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
