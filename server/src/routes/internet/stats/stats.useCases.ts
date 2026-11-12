import type { StatsRecordResponse, StatsRequestSchema } from "@personal-tracker/shared/internet";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";

import type { InternetRepository } from "../internet.repository";

import { getEpisodeTags, sortByDuration } from "../internet.entity";

type StatsQuery = z.infer<typeof StatsRequestSchema>;

export class GetStatsUseCase {
	constructor(private repo: InternetRepository) {}

	async execute({ from, to }: StatsQuery, log: FastifyBaseLogger) {
		log.info("GetStatsUseCase.execute");
		const rawData = await this.repo.findStatsRaw({ from, to });
		const results: StatsRecordResponse = rawData?.reduce(
			(acc: any, program: any) => {
				acc.summary.nbPrograms += 1;
				if (!acc.programs[program.id]) {
					acc.programs[program.id] = {
						name: program.shortName || program.name,
						duration: 0,
					};
				}
				program.episodes.forEach((ep: any) => {
					acc.summary.nbEpisodes += 1;
					const duration = ep.durationReal ?? ep.duration;
					acc.programs[program.id].duration += duration;
					acc.summary.total += duration;
					getEpisodeTags(program.tags, ep).forEach((tag: string) => {
						if (!acc.tags[tag]) {
							acc.tags[tag] = {
								name: tag,
								duration: 0,
								details: {},
							};
						}
						acc.tags[tag].duration += duration;
						if (!acc.tags[tag].details[program.id]) {
							acc.tags[tag].details[program.id] = { name: program.name, duration: 0 };
						}
						acc.tags[tag].details[program.id].duration += duration;
					});
				});

				return acc;
			},
			{
				programs: {},
				tags: {},
				summary: {
					averageByDays: 0,
					total: 0,
					nbPrograms: 0,
					nbEpisodes: 0,
					nbDays: 0,
				},
			},
		);

		const now = Temporal.Now.plainDateISO();
		let nbDays = 0;
		let inProgress = true;

		const startPeriod = Temporal.PlainDate.from(from);
		const endPeriod = Temporal.PlainDate.from(to);
		if (Temporal.PlainDate.compare(now, startPeriod) < 0) {
			// period in future
			nbDays = 0;
			inProgress = true;
		} else if (Temporal.PlainDate.compare(endPeriod, now) < 0) {
			// period in past
			nbDays = Math.abs(startPeriod.until(endPeriod).days + 1);
			inProgress = false;
		} else {
			// current period
			nbDays = Math.abs(startPeriod.until(now).days + 1);
			inProgress = true;
		}

		return {
			summary: {
				averageByDays: Math.round(results.summary.total / nbDays),
				total: results.summary.total,
				nbPrograms: results.summary.nbPrograms,
				nbEpisodes: results.summary.nbEpisodes,
				nbDays: nbDays,
				inProgress: inProgress,
			},
			programs: Object.values(results.programs).sort(sortByDuration),
			tags: Object.values(results.tags)
				.map((tag) => {
					return { ...tag, details: Object.values(tag.details).sort(sortByDuration) };
				})
				.sort(sortByDuration),
		};
	}
}

export class GetFortnightStatsUseCase {
	constructor(private repo: InternetRepository) {}

	async execute(log: FastifyBaseLogger) {
		log.info("GetFortnightStatsUseCase.execute");
		const today = Temporal.Now.plainDateISO();
		const from = today.subtract({ days: 13 });
		const to = today;

		// Data queries
		const data = await this.repo.findEpisodesInRange({ from: from.toString(), to: to.toString() });

		const dayDistribution: Record<string, number> = {};
		for (let date = from; Temporal.PlainDate.compare(date, to) <= 0; date = date.add({ days: 1 })) {
			dayDistribution[date.toString()] = 0;
		}

		for (let program of data ?? []) {
			for (let episode of program.episodes) {
				if (typeof dayDistribution[episode.date] === "undefined") {
					console.error("Ignoring", episode.date, "period", from.toString(), to.toString());
					continue;
				}
				dayDistribution[episode.date] += episode.durationReal ?? episode.duration;
			}
		}

		return Object.entries(dayDistribution)
			.map(([date, duration]) => ({ date, duration }))
			.toSorted((a, b) => a.date.localeCompare(b.date));
	}
}
