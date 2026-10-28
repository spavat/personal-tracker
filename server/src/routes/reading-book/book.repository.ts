import type { FastifyInstance } from "fastify";

interface BookListFilters {
	from?: string;
	to?: string;
	withReadingsDetails: boolean;
	sortField?: string;
	sortDirection?: string;
}

export class BookRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get collection() {
		return this.mongo?.db?.collection("reading_book");
	}

	findAll({ from, to, withReadingsDetails, sortField = "book", sortDirection = "asc" }: BookListFilters) {
		const cursor = this.collection?.aggregate([
			// add readingDates for readings
			{
				$addFields: {
					readings: {
						$map: {
							input: "$readings",
							as: "reading",
							in: {
								$let: {
									vars: {
										dates: {
											$reduce: {
												input: "$$reading.details",
												initialValue: [],
												in: {
													$setUnion: [
														"$$value",
														{
															$map: {
																input: "$$this.context",
																as: "ctx",
																in: "$$ctx.date",
															},
														},
													],
												},
											},
										},
									},
									in: {
										$mergeObjects: [
											"$$reading",
											{
												readingDates: "$$dates",
												firstReadDate: { $min: "$$dates" },
												lastReadDate: { $max: "$$dates" },
											},
										],
									},
								},
							},
						},
					},
				},
			},
			// keep only the readings whose own dates fall within the range
			...(from && to
				? [
						{
							$addFields: {
								readings: {
									$filter: {
										input: "$readings",
										as: "reading",
										cond: {
											$gt: [
												{
													$size: {
														$filter: {
															input: "$$reading.readingDates",
															cond: {
																$and: [
																	{ $gte: ["$$this", from] },
																	{ $lte: ["$$this", to] },
																],
															},
														},
													},
												},
												0,
											],
										},
									},
								},
							},
						},
					]
				: []),
			// keep only the reading details whose own dates fall within the range
			...(from && to
				? [
						{
							$addFields: {
								readings: {
									$map: {
										input: "$readings",
										as: "reading",
										in: {
											$mergeObjects: [
												"$$reading",
												{
													details: {
														$filter: {
															input: "$$reading.details",
															as: "detail",
															cond: {
																$gt: [
																	{
																		$size: {
																			$filter: {
																				input: "$$detail.context",
																				as: "ctx",
																				cond: {
																					$and: [
																						{ $gte: ["$$ctx.date", from] },
																						{ $lte: ["$$ctx.date", to] },
																					],
																				},
																			},
																		},
																	},
																	0,
																],
															},
														},
													},
												},
											],
										},
									},
								},
							},
						},
					]
				: []),
			// Add readingDates for the whole documents
			{
				$addFields: {
					readingDates: {
						$reduce: {
							input: "$readings",
							initialValue: [],
							in: {
								$setUnion: [
									"$$value",
									{
										$reduce: {
											input: "$$this.details",
											initialValue: [],
											in: {
												$setUnion: [
													"$$value",
													{
														$map: {
															input: "$$this.context",
															as: "ctx",
															in: "$$ctx.date",
														},
													},
												],
											},
										},
									},
								],
							},
						},
					},
				},
			},
			// add min date for the whole document
			{
				$addFields: {
					firstReadDate: { $min: "$readingDates" },
					lastReadDate: { $max: "$readingDates" },
					nbReadings: { $size: "$readings" },
				},
			},
			// filter by date if search query is present
			{
				$match: from && to ? { readingDates: { $elemMatch: { $gte: from, $lte: to } } } : {},
			},
			{
				$project: {
					_id: 0,
					...(!withReadingsDetails ? { "readings.details": 0 } : {}),
				},
			},
			{
				$sort: {
					[sortField]: sortDirection === "asc" ? 1 : -1,
				},
			},
		]);

		return cursor?.toArray();
	}

	findById(id: string) {
		return this.collection?.findOne({ id }, { projection: { _id: 0 } });
	}

	insert(book: Record<string, unknown>) {
		return this.collection?.insertOne(book as any);
	}

	update(id: string, book: Record<string, unknown>) {
		return this.collection?.updateOne({ id }, { $set: { ...book } });
	}

	updateModel(id: string, model: unknown) {
		return this.collection?.updateOne({ id }, { $set: { model } });
	}

	pushReading(bookId: string, reading: Record<string, unknown>) {
		return this.collection?.updateOne({ id: bookId }, { $push: { readings: reading } } as any);
	}

	updateReading(bookId: string, reading: { id: string; status: string; details: unknown }) {
		return this.collection?.updateOne(
			{ id: bookId },
			{
				$set: {
					"readings.$[reading].status": reading.status,
					"readings.$[reading].details": reading.details,
				},
			},
			{ arrayFilters: [{ "reading.id": reading.id }] },
		);
	}

	deleteReading(bookId: string, readingId: string) {
		return this.collection?.updateOne({ id: bookId }, { $pull: { readings: { id: readingId } } } as any);
	}
}
