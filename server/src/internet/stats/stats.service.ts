import type { StatsRequestSchema } from "@personal-tracker/shared/internet";
import type { z } from "zod";

import { Injectable, Logger } from "@nestjs/common";

import { getEpisodeTags, sortByDuration } from "../internet.entity.js";
import { InternetRepository } from "../internet.repository.js";

export type StatsQuery = z.infer<typeof StatsRequestSchema>;

type Duration = { name: string; duration: number };

@Injectable()
export class StatsService {
	private readonly logger = new Logger(StatsService.name);
	constructor(private readonly repo: InternetRepository) {}

	// Watched / listened time by program and by tag over the period (the real duration when known)
	async stats({ from, to }: StatsQuery) {
		this.logger.log("stats");
		const programs = await this.repo.findStatsRaw({ from, to });

		const byProgram: Record<string, Duration> = {};
		const byTag: Record<string, Duration & { details: Record<string, Duration> }> = {};
		let total = 0;
		let nbEpisodes = 0;
		for (const program of programs) {
			byProgram[program.id] ??= { name: program.shortName || program.name, duration: 0 };
			for (const episode of program.episodes) {
				const duration = episode.durationReal ?? episode.duration;
				nbEpisodes += 1;
				total += duration;
				byProgram[program.id].duration += duration;
				for (const tag of getEpisodeTags(program.tags, episode)) {
					byTag[tag] ??= { name: tag, duration: 0, details: {} };
					byTag[tag].duration += duration;
					byTag[tag].details[program.id] ??= { name: program.name, duration: 0 };
					byTag[tag].details[program.id].duration += duration;
				}
			}
		}

		const { nbDays, inProgress } = periodDays(from, to);
		return {
			summary: {
				averageByDays: Math.round(total / nbDays),
				total,
				nbPrograms: programs.length,
				nbEpisodes,
				nbDays,
				inProgress,
			},
			programs: Object.values(byProgram).toSorted(sortByDuration),
			tags: Object.values(byTag)
				.map((tag) => ({ ...tag, details: Object.values(tag.details).toSorted(sortByDuration) }))
				.toSorted(sortByDuration),
		};
	}

	// Duration per day over the last 14 days, today included
	async fortnight() {
		this.logger.log("fortnight");
		const today = Temporal.Now.plainDateISO();
		const from = today.subtract({ days: 13 });

		const dayDistribution: Record<string, number> = {};
		for (let date = from; Temporal.PlainDate.compare(date, today) <= 0; date = date.add({ days: 1 })) {
			dayDistribution[date.toString()] = 0;
		}

		const programs = await this.repo.findEpisodesInRange({ from: from.toString(), to: today.toString() });
		for (const program of programs) {
			for (const episode of program.episodes) {
				if (dayDistribution[episode.date] === undefined) {
					this.logger.error(`Ignoring an episode of ${episode.date}, out of ${from} - ${today}`);
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

// Days elapsed in the period: none for a future period, up to today for the current one
function periodDays(from: string, to: string) {
	const now = Temporal.Now.plainDateISO();
	const start = Temporal.PlainDate.from(from);
	const end = Temporal.PlainDate.from(to);
	if (Temporal.PlainDate.compare(now, start) < 0) {
		return { nbDays: 0, inProgress: true };
	}
	if (Temporal.PlainDate.compare(end, now) < 0) {
		return { nbDays: Math.abs(start.until(end).days + 1), inProgress: false };
	}
	return { nbDays: Math.abs(start.until(now).days + 1), inProgress: true };
}
