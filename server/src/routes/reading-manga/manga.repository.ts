import type { Reading } from "@personal-tracker/shared/reading-manga";
import type { FastifyInstance } from "fastify";

interface MangaListFilters {
	search?: string;
	from?: string;
	to?: string;
	withReadings: boolean;
	sortField?: string;
	sortDirection?: string;
}

export class MangaRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get collection() {
		return this.mongo?.db?.collection("reading_manga");
	}

	findAll({ search, from, to, withReadings, sortField = "title", sortDirection = "asc" }: MangaListFilters) {
		const pipeline: Record<string, unknown>[] = [];

		if (search) {
			pipeline.push({
				$match: {
					$or: [
						{ title: new RegExp(`${search.normalize("NFC")}`, "i") },
						{ titleEnglish: new RegExp(`${search.normalize("NFC")}`, "i") },
						{ author: new RegExp(`${search.normalize("NFC")}`, "i") },
						{ art: new RegExp(`${search.normalize("NFC")}`, "i") },
						{ scenario: new RegExp(`${search.normalize("NFC")}`, "i") },
					],
				},
			});
		}
		if (from || to) {
			pipeline.push({
				// Keep only mangas with at least one reading in the period
				$match: {
					readings: {
						$elemMatch: {
							date: {
								$gte: from,
								$lte: to,
							},
						},
					},
				},
			});
			pipeline.push({
				// Replace readings array without touching other fields
				$set: {
					readings: {
						$filter: {
							input: "$readings",
							as: "reading",
							cond: {
								$and: [{ $gte: ["$$reading.date", from] }, { $lte: ["$$reading.date", to] }],
							},
						},
					},
				},
			});
		}

		const cursor = this.collection?.aggregate([
			...pipeline,
			{
				$set: {
					firstReadingDate: {
						$min: "$readings.date",
					},
					lastReadingDate: {
						$max: "$readings.date",
					},
					latestReadingCreated: {
						$max: "$readings.created",
					},
				},
			},
			{
				$project: {
					_id: 0,
					...(!withReadings ? { readings: 0 } : {}),
				},
			},
			{
				$sort: {
					[sortField]: sortDirection === "asc" ? 1 : -1,
					latestReadingCreated: -1,
				},
			},
		]);

		return cursor?.toArray();
	}

	findById(id: string) {
		const cursor = this.collection?.aggregate([
			{
				$match: { id },
			},
			{
				$addFields: {
					readings: {
						$sortArray: {
							input: "$readings",
							sortBy: {
								date: -1,
								created: -1,
							},
						},
					},
				},
			},
			{
				$project: {
					_id: 0,
				},
			},
		]);

		return cursor?.next();
	}

	insert(manga: Record<string, unknown>) {
		return this.collection?.insertOne(manga as any);
	}

	update(id: string, manga: Record<string, unknown>) {
		return this.collection?.updateOne({ id }, { $set: manga }, { upsert: false });
	}

	pushReading(mangaId: string, reading: Reading) {
		return this.collection?.updateOne({ id: mangaId }, { $push: { readings: reading } } as any);
	}

	updateReading(mangaId: string, reading: Reading) {
		// Transform reading fields to dot notation
		const setFields = Object.fromEntries(
			Object.entries(reading).map(([key, value]) => [`readings.$[element].${key}`, value]),
		);

		return this.collection?.updateOne(
			{ id: mangaId },
			{ $set: setFields },
			{ arrayFilters: [{ "element.id": reading.id }] },
		);
	}

	deleteReading(mangaId: string, readingId: string) {
		return this.collection?.updateOne({ id: mangaId }, { $pull: { readings: { id: readingId } } } as any);
	}
}
