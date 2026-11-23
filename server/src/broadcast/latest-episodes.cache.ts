import type { LatestEpisodesResponse } from "@personal-tracker/shared/broadcast";

import { Injectable } from "@nestjs/common";

// The latest episodes fetched per program, shared by the latest-episodes routes and the podcast sync.
// One instance for the whole app: provided once by BroadcastSharedModule (a module is a singleton).
@Injectable()
export class LatestEpisodesCache {
	private readonly cache = new Map<string, LatestEpisodesResponse>();

	get(programId: string) {
		return this.cache.get(programId);
	}

	set(programId: string, value: LatestEpisodesResponse) {
		this.cache.set(programId, value);
	}
}
