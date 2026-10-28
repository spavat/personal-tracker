import type { LatestEpisodesResponse } from "@personal-tracker/shared/internet";

export class LatestEpisodesCacheRepository {
	private cache = new Map<string, LatestEpisodesResponse>();

	get(programId: string) {
		return this.cache.get(programId);
	}

	set(programId: string, value: LatestEpisodesResponse) {
		this.cache.set(programId, value);
	}
}
