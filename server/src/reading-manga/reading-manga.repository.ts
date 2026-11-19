import type { Manga, Reading } from "@personal-tracker/shared/reading-manga";

import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";

import { MONGO_DB } from "../database/database.tokens.js";
import { accentInsensitiveRegex } from "../database/mongo-search.js";

export interface MangaListFilters {
	search?: string;
	from?: string;
	to?: string;
	withReadings: boolean;
	sortField?: string;
	sortDirection?: string;
	limit?: number;
}

@Injectable()
export class ReadingMangaRepository {
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	private get collection() {
		return this.db.collection<Manga>("reading_manga");
	}

	findAll({ search, from, to, withReadings, sortField = "title", sortDirection = "asc", limit }: MangaListFilters) {
		const pipeline: Record<string, unknown>[] = [];

		if (search) {
			pipeline.push({
				$match: {
					$or: [
						{ title: accentInsensitiveRegex(search) },
						{ titleEnglish: accentInsensitiveRegex(search) },
						{ author: accentInsensitiveRegex(search) },
						{ art: accentInsensitiveRegex(search) },
						{ scenario: accentInsensitiveRegex(search) },
					],
				},
			});
		}
		if (from || to) {
			pipeline.push({
				// Keep only mangas with at least one reading in the period
				$match: { readings: { $elemMatch: { date: { $gte: from, $lte: to } } } },
			});
			pipeline.push({
				// Replace readings array without touching other fields
				$set: {
					readings: {
						$filter: {
							input: "$readings",
							as: "reading",
							cond: { $and: [{ $gte: ["$$reading.date", from] }, { $lte: ["$$reading.date", to] }] },
						},
					},
				},
			});
		}

		return this.collection
			.aggregate([
				...pipeline,
				{
					$set: {
						firstReadingDate: { $min: "$readings.date" },
						lastReadingDate: { $max: "$readings.date" },
						latestReadingCreated: { $max: "$readings.created" },
					},
				},
				{ $project: { _id: 0, ...(!withReadings ? { readings: 0 } : {}) } },
				{ $sort: { [sortField]: sortDirection === "asc" ? 1 : -1, latestReadingCreated: -1 } },
				...(limit ? [{ $limit: limit }] : []),
			])
			.toArray();
	}

	findById(id: string) {
		return this.collection
			.aggregate<Manga>([
				{ $match: { id } },
				{ $addFields: { readings: { $sortArray: { input: "$readings", sortBy: { date: -1, created: -1 } } } } },
				{ $project: { _id: 0 } },
			])
			.next();
	}

	insert(manga: Manga) {
		return this.collection.insertOne(manga);
	}

	update(id: string, manga: Partial<Manga>) {
		return this.collection.updateOne({ id }, { $set: manga }, { upsert: false });
	}

	pushReading(mangaId: string, reading: Reading) {
		return this.collection.updateOne({ id: mangaId }, { $push: { readings: reading } });
	}

	updateReading(mangaId: string, reading: Reading) {
		// Transform reading fields to dot notation
		const setFields = Object.fromEntries(
			Object.entries(reading).map(([key, value]) => [`readings.$[element].${key}`, value]),
		);

		return this.collection.updateOne(
			{ id: mangaId },
			{ $set: setFields },
			{ arrayFilters: [{ "element.id": reading.id }] },
		);
	}

	deleteReading(mangaId: string, readingId: string) {
		return this.collection.updateOne({ id: mangaId }, { $pull: { readings: { id: readingId } } });
	}
}
