import type { WatchlistResponse } from "@personal-tracker/shared/broadcast";

import { Injectable, Logger } from "@nestjs/common";

import { byRelease } from "../broadcast.entity.js";
import { BroadcastRepository } from "../broadcast.repository.js";

@Injectable()
export class WatchlistService {
	private readonly logger = new Logger(WatchlistService.name);
	constructor(private readonly repo: BroadcastRepository) {}

	async plannedEpisodes(): Promise<WatchlistResponse> {
		this.logger.log("plannedEpisodes");
		return (await this.repo.findWatchlist()).toSorted((a, b) => byRelease(a.episode, b.episode));
	}
}
