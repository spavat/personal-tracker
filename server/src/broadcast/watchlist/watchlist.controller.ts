import { Controller, Get, SerializeOptions } from "@nestjs/common";
import { WatchlistResponseSchema } from "@personal-tracker/shared/broadcast";

import { WatchlistService } from "./watchlist.service.js";

@Controller()
export class WatchlistController {
	constructor(private readonly service: WatchlistService) {}

	@Get()
	@SerializeOptions({ schema: WatchlistResponseSchema.element })
	plannedEpisodes() {
		return this.service.plannedEpisodes();
	}
}
