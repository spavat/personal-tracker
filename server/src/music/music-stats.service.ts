import type { GetReportResponse, StatsResponse } from "@personal-tracker/shared/music";

import { Injectable, Logger } from "@nestjs/common";

import { getMonthsBetween } from "../common/utils.date.js";
import { mapSubGenres } from "./genres.entity.js";
import { GenresRepository } from "./genres.repository.js";
import { getDaysBetween, getDaysForAverageCount, sortByDuration, sortByKey, StatsDuration } from "./music.entity.js";
import { MusicRepository } from "./music.repository.js";

interface ArtistItem {
	name: string;
	duration: number;
}
interface GenreItem {
	name: string;
	duration: number;
	artists: Record<string, ArtistItem>;
}

@Injectable()
export class MusicStatsService {
	private readonly logger = new Logger(MusicStatsService.name);
	constructor(
		private readonly musicRepo: MusicRepository,
		private readonly genresRepo: GenresRepository,
	) {}

	async stats({ from, to }: { from: string; to: string }): Promise<StatsResponse> {
		this.logger.log("stats");
		const today = Temporal.Now.plainDateISO().toString();

		// Data queries
		const listeningsData = await this.musicRepo.findAll({ from, to });
		const mapGenres = mapSubGenres(await this.genresRepo.findAll());

		// Pre-process (Initialisation)
		const monthsDistribution: Record<string, StatsDuration> = {};
		for (const monthValue of getMonthsBetween({ from, to })) {
			monthsDistribution[monthValue] = { key: monthValue, name: monthValue, duration: 0, details: {} };
		}
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
		for (const item of listeningsData) {
			// Month distribution
			const monthKey = item.listeningDate.substring(0, 7);
			monthsDistribution[monthKey].duration += item.duration;

			// Genres
			const genre = mapGenres[item.genre] ?? item.genre;
			if (!genresDistribution[genre]) {
				genresDistribution[genre] = { name: genre, key: genre, duration: 0, details: {} };
			}
			genresDistribution[genre].duration += item.duration;
			for (const artist of item.artist) {
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
			}

			// Release Year
			const yearKey = item.releaseDate.substring(0, 4) || "XXXX";
			if (!releaseYearsDistribution[yearKey]) {
				releaseYearsDistribution[yearKey] = { name: yearKey, key: yearKey, duration: 0, details: {} };
			}
			releaseYearsDistribution[yearKey].duration += item.duration;

			// Stats
			stats.totalDuration += item.duration;
			stats.nbListenings += 1;
		}

		// Post-process
		stats.averageDurationPerDay = Math.round(stats.totalDuration / stats.nbDays);

		return {
			monthsDistribution: Object.values(monthsDistribution)
				.map((item) => ({ ...item, details: [] }))
				.toSorted(sortByKey),
			genresDistribution: Object.values(genresDistribution)
				.map((genreItem) => ({
					...genreItem,
					details: Object.values(genreItem.details).toSorted(sortByDuration),
				}))
				.toSorted(sortByDuration),
			releaseYearsDistribution: Object.values(releaseYearsDistribution)
				.map((item) => ({ ...item, details: [] }))
				.toSorted(sortByKey),
			...stats,
		};
	}

	async fortnightStats() {
		this.logger.log("fortnightStats");
		const today = Temporal.Now.plainDateISO();
		const from = today.subtract({ days: 13 });
		const to = today;

		const listeningsData = await this.musicRepo.findAll({ from: from.toString(), to: to.toString() });

		const dayDistribution: Record<string, number> = {};
		for (let date = from; Temporal.PlainDate.compare(date, to) <= 0; date = date.add({ days: 1 })) {
			dayDistribution[date.toString()] = 0;
		}

		for (const listening of listeningsData) {
			if (typeof dayDistribution[listening.listeningDate] === "undefined") {
				this.logger.error(`Ignoring listening ${listening.listeningDate}, period ${from} - ${to}`);
				continue;
			}
			dayDistribution[listening.listeningDate] += listening.duration;
		}

		return Object.entries(dayDistribution)
			.map(([date, duration]) => ({ date, duration }))
			.toSorted((a, b) => a.date.localeCompare(b.date));
	}

	async report({ from, to }: { from: string; to: string }): Promise<GetReportResponse> {
		this.logger.log("report");
		const listenings = await this.musicRepo.findAll({ from, to });
		const mapGenres = mapSubGenres(await this.genresRepo.findAll());

		const allDates = new Set<string>();
		const genresDistribution: Record<string, GenreItem> = {};
		const artistDistribution: Record<string, ArtistItem> = {};
		let totalListenings = 0;
		let totalDuration = 0;
		const daysCount = getDaysForAverageCount(from, to);
		for (const listening of listenings) {
			totalListenings += 1;
			totalDuration += listening.duration;
			allDates.add(listening.listeningDate);

			// Genre
			const genre = mapGenres[listening.genre] ?? listening.genre;
			const genreKey = genre.toLocaleLowerCase();
			if (!genresDistribution[genreKey]) {
				genresDistribution[genreKey] = { name: genre, duration: 0, artists: {} };
			}
			genresDistribution[genreKey].duration += listening.duration;

			for (const artist of listening.artist) {
				const artistKey = artist.toLowerCase();
				if (!listening.compilation) {
					// Artist
					if (!artistDistribution[artistKey]) {
						artistDistribution[artistKey] = { name: artist, duration: 0 };
					}
					artistDistribution[artistKey].duration += listening.duration;
				}

				// Genre -> Artist
				if (!genresDistribution[genreKey].artists[artistKey]) {
					genresDistribution[genreKey].artists[artistKey] = { name: artist, duration: 0 };
				}
				genresDistribution[genreKey].artists[artistKey].duration += listening.duration;
			}
		}

		return {
			hasData: listenings.length > 0,
			stats: {
				averageDurationByDay: Math.round(totalDuration / daysCount),
				totalDuration,
				artistsCount: Object.keys(artistDistribution).length,
				albumsCount: totalListenings,
				uniqueDaysCount: allDates.size,
				periodDaysCount: daysCount,
			},
			artists: Object.values(artistDistribution)
				.map(({ name, duration }) => ({ name, duration }))
				.toSorted(sortByDuration)
				.slice(0, 15),
			genres: Object.values(genresDistribution)
				.map(({ name, duration, artists }) => ({
					name,
					duration,
					artists: Object.values(artists)
						.map(({ name, duration }) => ({ name, duration }))
						.toSorted(sortByDuration)
						.slice(0, 5),
				}))
				.toSorted(sortByDuration)
				.slice(0, 10),
		};
	}
}
