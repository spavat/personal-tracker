import type { ReviewEpisodesResponse } from "@personal-tracker/shared/broadcast";

import { Injectable, Logger } from "@nestjs/common";

import { getEpisodeTags, sortEpisodesDesc } from "../broadcast.entity.js";
import { BroadcastRepository } from "../broadcast.repository.js";

@Injectable()
export class ReviewService {
	private readonly logger = new Logger(ReviewService.name);
	constructor(private readonly repo: BroadcastRepository) {}

	// Episodes left without any tag (none of their own, none kept from the program), most recent first
	async untaggedEpisodes(): Promise<ReviewEpisodesResponse> {
		this.logger.log("untaggedEpisodes");
		const programs = await this.repo.findAllWithEpisodes();
		return programs
			.flatMap((program) =>
				(program.episodes ?? [])
					.filter((episode) => getEpisodeTags(program.tags, episode).length === 0)
					.map((episode) => ({ programId: program.id, programName: program.name, episode })),
			)
			.toSorted((a, b) => sortEpisodesDesc(a.episode, b.episode));
	}
}
