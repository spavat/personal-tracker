import type { Manga, Reading } from "@personal-tracker/shared/reading-manga";

import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";

import { MONGO_DB } from "../database/database.tokens.js";
import { accentInsensitiveRegex } from "../database/mongo-search.query.js";

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

	// a copy: the driver adds `_id` to the document it inserts
	async insert(manga: Manga) {
		await this.collection.insertOne({ ...manga });
		return manga;
	}

	// the updated manga, null for an unknown id
	update(id: string, manga: Partial<Manga>) {
		return this.collection.findOneAndUpdate(
			{ id },
			{ $set: manga },
			{ projection: { _id: 0 }, returnDocument: "after" },
		);
	}

	// false for an unknown manga
	async pushReading(mangaId: string, reading: Reading) {
		return (await this.collection.updateOne({ id: mangaId }, { $push: { readings: reading } })).matchedCount > 0;
	}

	// false for an unknown manga or reading
	async updateReading(mangaId: string, reading: Reading) {
		// Transform reading fields to dot notation
		const setFields = Object.fromEntries(
			Object.entries(reading).map(([key, value]) => [`readings.$[element].${key}`, value]),
		);

		const result = await this.collection.updateOne(
			{ id: mangaId, "readings.id": reading.id },
			{ $set: setFields },
			{ arrayFilters: [{ "element.id": reading.id }] },
		);
		return result.matchedCount > 0;
	}

	// false for an unknown manga or reading
	async deleteReading(mangaId: string, readingId: string) {
		const result = await this.collection.updateOne(
			{ id: mangaId, "readings.id": readingId },
			{ $pull: { readings: { id: readingId } } },
		);
		return result.modifiedCount > 0;
	}
}
