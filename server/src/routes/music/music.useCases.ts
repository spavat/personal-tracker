import type { GetReportResponse, SaveBodyRequestSchema } from "@personal-tracker/shared/music";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";

import { randomUUID } from "node:crypto";

import type { GenreRepository } from "./genre.repository";
import type { MusicRepository } from "./music.repository";

import { getMonthsBetween } from "../../utils.date";
import {
	cleanListening,
	getDaysBetween,
	getDaysForAverageCount,
	sortByDuration,
	sortByKey,
	StatsDuration,
} from "./music.entity";

type SaveListeningBody = z.infer<typeof SaveBodyRequestSchema>;

export class ListListeningsUseCase {
	constructor(private repo: MusicRepository) {}

	execute({ from, to }: { from?: string; to?: string }, log: FastifyBaseLogger) {
		log.info("ListListeningsUseCase.execute");
		return this.repo.findAll({ from, to });
	}
}

export class SearchListeningsUseCase {
	constructor(private repo: MusicRepository) {}

	execute(search: string | undefined, log: FastifyBaseLogger) {
		log.info("SearchListeningsUseCase.execute");
		return this.repo.searchListenings(search);
	}
}

export class GetListeningUseCase {
	constructor(private repo: MusicRepository) {}

	execute(id: string, log: FastifyBaseLogger) {
		log.info("GetListeningUseCase.execute");
		return this.repo.findById(id);
	}
}

export class SaveListeningUseCase {
	constructor(private repo: MusicRepository) {}

	execute(listeningData: SaveListeningBody, log: FastifyBaseLogger) {
		log.info("SaveListeningUseCase.execute");
		const { id, ...dataToSave } = listeningData;
		const cleanedListening = cleanListening(dataToSave);
		if (id) {
			// update
			return this.repo.update(id, cleanedListening);
		}
		// insert
		return this.repo.insert({
			id: randomUUID(),
			created: Temporal.Now.plainDateTimeISO().toString(),
			...cleanedListening,
		});
	}
}

export class DeleteListeningUseCase {
	constructor(private repo: MusicRepository) {}

	execute(id: string, log: FastifyBaseLogger) {
		log.info("DeleteListeningUseCase.execute");
		return this.repo.delete(id);
	}
}

export class GetStatsUseCase {
	constructor(
		private musicRepo: MusicRepository,
		private genreRepo: GenreRepository,
	) {}

	async execute({ from, to }: { from: string; to: string }, log: FastifyBaseLogger) {
		log.info("GetStatsUseCase.execute");
		const today = Temporal.Now.plainDateISO().toString();

		// Data queries
		const listeningsData = await this.musicRepo.findAll({ from, to });
		const genresData = await this.genreRepo.findAll();

		// Pre-process (Initialisation)
		const mapGenres = (genresData ?? []).reduce<Record<string, string>>((acc, mainGenre) => {
			mainGenre.genres.forEach((genre: string) => {
				acc[genre] = mainGenre.name;
			});
			return acc;
		}, {});

		const monthList = getMonthsBetween({ from, to });
		const monthsDistribution: Record<string, StatsDuration> = monthList.reduce(
			(acc: Record<string, StatsDuration>, monthValue) => {
				acc[monthValue] = {
					key: monthValue,
					name: monthValue,
					duration: 0,
					details: {},
				};
				return acc;
			},
			{},
		);
		const genresDistribution: Record<string, StatsDuration> = {};
		const releaseYearsDistribution: Record<string, StatsDuration> = {};
		const stats = {
			totalDuration: 0,
			nbListenings: 0,
			nbDays: getDaysBetween(from, today < to ? today : to),
			averageDurationPerDay: 0,
			inProgress: today < to,
		};

		// Process listenings
		listeningsData?.forEach((item) => {
			// Month distribution
			const monthKey = item.listeningDate.substring(0, 7);
			monthsDistribution[monthKey].duration += item.duration;

			// Genres
			const genre = mapGenres[item.genre] ?? item.genre;
			if (!genresDistribution[genre]) {
				genresDistribution[genre] = {
					name: genre,
					key: genre,
					duration: 0,
					details: {},
				};
			}
			genresDistribution[genre].duration += item.duration;
			item.artist.forEach((artist: string) => {
				const lowerArtist = artist.toLocaleLowerCase();
				if (!genresDistribution[genre].details[lowerArtist]) {
					genresDistribution[genre].details[lowerArtist] = {
						key: lowerArtist,
						name: artist,
						duration: 0,
						count: 0,
					};
				}
				genresDistribution[genre].details[lowerArtist].duration += item.duration;
				genresDistribution[genre].details[lowerArtist].count += 1;
			});

			// Release Year
			const yearKey = item.releaseDate.substring(0, 4) || "XXXX";
			if (!releaseYearsDistribution[yearKey]) {
				releaseYearsDistribution[yearKey] = {
					name: yearKey,
					key: yearKey,
					duration: 0,
					details: {},
				};
			}
			releaseYearsDistribution[yearKey].duration += item.duration;

			// Stats
			stats.totalDuration += item.duration;
			stats.nbListenings += 1;
		});

		// Post-process
		const sortedMonthsDistribution = Object.values(monthsDistribution)
			.map((item) => ({ ...item, details: [] }))
			.toSorted(sortByKey);
		const sortedGenresDistribution = Object.values(genresDistribution)
			.map((genreItem) => ({
				...genreItem,
				details: Object.values(genreItem.details).toSorted(sortByDuration),
			}))
			.toSorted(sortByDuration);
		const sortedReleaseYearsDistribution = Object.values(releaseYearsDistribution)
			.map((item) => ({ ...item, details: [] }))
			.toSorted(sortByKey);
		stats.averageDurationPerDay = Math.round(stats.totalDuration / stats.nbDays);

		return {
			monthsDistribution: sortedMonthsDistribution,
			genresDistribution: sortedGenresDistribution,
			releaseYearsDistribution: sortedReleaseYearsDistribution,
			...stats,
		};
	}
}

export class GetFortnightStatsUseCase {
	constructor(private musicRepo: MusicRepository) {}

	async execute(log: FastifyBaseLogger) {
		log.info("GetFortnightStatsUseCase.execute");
		const today = Temporal.Now.plainDateISO();
		const from = today.subtract({ days: 13 });
		const to = today;

		// Data queries
		const listeningsData = await this.musicRepo.findAll({ from: from.toString(), to: to.toString() });

		const dayDistribution: Record<string, number> = {};
		for (let date = from; Temporal.PlainDate.compare(date, to) <= 0; date = date.add({ days: 1 })) {
			dayDistribution[date.toString()] = 0;
		}

		for (let listening of listeningsData ?? []) {
			if (typeof dayDistribution[listening.listeningDate] === "undefined") {
				console.error("Ignoring listening", listening.listeningDate, "period", from.toString(), to.toString());
				continue;
			}
			dayDistribution[listening.listeningDate] += listening.duration;
		}

		return Object.entries(dayDistribution)
			.map(([date, duration]) => ({ date, duration }))
			.toSorted((a, b) => a.date.localeCompare(b.date));
	}
}

interface ArtistItem {
	name: string;
	duration: number;
}
interface GenreItem {
	name: string;
	duration: number;
	artists: Record<string, ArtistItem>;
}
export class GetReportUseCase {
	constructor(
		private musicRepo: MusicRepository,
		private genreRepo: GenreRepository,
	) {}

	async execute({ from, to }: { from: string; to: string }, log: FastifyBaseLogger): Promise<GetReportResponse> {
		log.info("GetReportUseCase.execute");
		const listenings = await this.musicRepo.findAll({ from, to });

		const genreGroups = (await this.genreRepo.findAll()) ?? [];
		const mapGenres: Record<string, string> = {};
		for (const mainGenre of genreGroups) {
			for (const genre of mainGenre.genres) {
				mapGenres[genre] = mainGenre.name;
			}
		}

		const allDates = new Set<string>();
		const genresDistribution: Record<string, GenreItem> = {};
		const artistDistribution: Record<string, ArtistItem> = {};
		let totalListenings = 0;
		let totalDuration = 0;
		const daysCount = getDaysForAverageCount(from, to);
		for (let listening of listenings ?? []) {
			totalListenings += 1;
			totalDuration += listening.duration;
			allDates.add(listening.listeningDate);

			// Genre
			const genre = mapGenres[listening.genre] ?? listening.genre;
			const genreKey = genre.toLocaleLowerCase();
			if (!genresDistribution[genreKey]) {
				genresDistribution[genreKey] = {
					name: genre,
					duration: 0,
					artists: {},
				};
			}
			genresDistribution[genreKey].duration += listening.duration;

			for (let artist of listening.artist) {
				const artistKey = artist.toLowerCase();
				if (!listening.compilation) {
					// Artist
					if (!artistDistribution[artistKey]) {
						artistDistribution[artistKey] = {
							name: artist,
							duration: 0,
						};
					}
					artistDistribution[artistKey].duration += listening.duration;
				}

				// Genre -> Artist
				if (!genresDistribution[genreKey].artists[artistKey]) {
					genresDistribution[genreKey].artists[artistKey] = {
						name: artist,
						duration: 0,
					};
				}
				genresDistribution[genreKey].artists[artistKey].duration += listening.duration;
			}
		}

		return {
			hasData: Array.isArray(listenings) && listenings.length > 0,
			stats: {
				averageDurationByDay: Math.round(totalDuration / daysCount),
				totalDuration,
				artistsCount: Object.keys(artistDistribution).length,
				albumsCount: totalListenings,
				uniqueDaysCount: allDates.size,
				periodDaysCount: daysCount,
			},
			artists: Object.values(artistDistribution)
				.map((values) => ({
					name: values.name,
					duration: values.duration,
				}))
				.toSorted((a, b) => b.duration - a.duration)
				.slice(0, 15),
			genres: Object.values(genresDistribution)
				.map((values) => ({
					name: values.name,
					duration: values.duration,
					artists: Object.values(values.artists)
						.map(({ name, duration }) => ({
							name: name,
							duration: duration,
						}))
						.toSorted((a, b) => b.duration - a.duration)
						.slice(0, 5),
				}))
				.toSorted((a, b) => b.duration - a.duration)
				.slice(0, 10),
		};
	}
}
