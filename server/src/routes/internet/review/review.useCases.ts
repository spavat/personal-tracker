import type { ReviewEpisodesResponse } from "@personal-tracker/shared/internet";
import type { FastifyBaseLogger } from "fastify";

import type { InternetRepository } from "../internet.repository";

import { getEpisodeTags, sortEpisodesDesc } from "../internet.entity";

// Episodes left without any tag (none of their own, none kept from the program)
export class ListUntaggedEpisodesUseCase {
	constructor(private repo: InternetRepository) {}

	async execute(log: FastifyBaseLogger): Promise<ReviewEpisodesResponse> {
		log.info("ListUntaggedEpisodesUseCase.execute");
		const programs = (await this.repo.findAllWithEpisodes()) ?? [];
		return programs
			.flatMap((program) =>
				(program.episodes ?? [])
					.filter((episode) => getEpisodeTags(program.tags, episode).length === 0)
					.map((episode) => ({ programId: program.id, programName: program.name, episode })),
			)
			.toSorted((a, b) => sortEpisodesDesc(a.episode, b.episode));
	}
}
