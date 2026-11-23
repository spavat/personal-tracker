import { Controller, Get, Query, SerializeOptions } from "@nestjs/common";
import {
	FortnightStatsResponseSchema,
	StatsArrayResponseSchema,
	StatsRequestSchema,
} from "@personal-tracker/shared/broadcast";

import { Public } from "../../auth/public.decorator.js";
import { type StatsQuery, StatsService } from "./stats.service.js";

@Controller()
export class StatsController {
	constructor(private readonly service: StatsService) {}

	@Get()
	@Public()
	@SerializeOptions({ schema: StatsArrayResponseSchema })
	stats(@Query({ schema: StatsRequestSchema }) query: StatsQuery) {
		return this.service.stats(query);
	}

	@Get("fortnight")
	@Public()
	@SerializeOptions({ schema: FortnightStatsResponseSchema.element })
	fortnight() {
		return this.service.fortnight();
	}
}
