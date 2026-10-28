import type { FastifyInstance } from "fastify";

import type { LifespanObjectMongo } from "./object.entity";

interface LifespanObjectListFilters {
	search: string;
	categoryId?: string;
	sortField: string;
	sortDirection: string;
}

// Derives usageStatus/possessionStatus from the embedded events array on read (never stored):
// - usageStatus follows the latest of start_usage/pause_usage/end_usage/dispose, so a dispose
//   with no prior end_usage still resolves to "ended".
// - possessionStatus is "disposed" once any dispose event exists, "owned" otherwise.
const STATUS_STAGES = [
	{
		$addFields: {
			_usageEvents: {
				$filter: {
					input: "$events",
					as: "e",
					cond: { $in: ["$$e.type", ["start_usage", "pause_usage", "end_usage", "dispose"]] },
				},
			},
		},
	},
	{
		$addFields: {
			_latestUsageEvent: {
				$arrayElemAt: [{ $sortArray: { input: "$_usageEvents", sortBy: { date: -1, created: -1 } } }, 0],
			},
		},
	},
	{
		$addFields: {
			usageStatus: {
				$switch: {
					/* oxlint-disable unicorn/no-thenable -- `then` is a MongoDB $switch branch key, not a Promise */
					branches: [
						{ case: { $eq: ["$_latestUsageEvent.type", "start_usage"] }, then: "in_use" },
						{ case: { $eq: ["$_latestUsageEvent.type", "pause_usage"] }, then: "paused" },
						{ case: { $eq: ["$_latestUsageEvent.type", "end_usage"] }, then: "ended" },
						{ case: { $eq: ["$_latestUsageEvent.type", "dispose"] }, then: "ended" },
					],
					/* oxlint-enable unicorn/no-thenable */
					default: "not_started",
				},
			},
			possessionStatus: {
				$cond: [{ $in: ["dispose", "$events.type"] }, "disposed", "owned"],
			},
		},
	},
	{ $project: { _usageEvents: 0, _latestUsageEvent: 0 } },
];

function escapeRegExp(text: string) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class LifespanObjectRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get collection() {
		return this.mongo?.db?.collection<LifespanObjectMongo>("lifespan_object");
	}

	findAll({ search, categoryId, sortField, sortDirection }: LifespanObjectListFilters) {
		const cursor = this.collection?.aggregate([
			{
				$match: {
					...(search ? { name: new RegExp(escapeRegExp(search.normalize("NFC")), "i") } : {}),
					...(categoryId ? { categoryId } : {}),
				},
			},
			...STATUS_STAGES,
			{ $project: { _id: 0 } },
			{ $sort: { [sortField]: sortDirection === "asc" ? 1 : -1 } },
		]);
		return cursor?.toArray();
	}

	async findById(id: string) {
		const cursor = this.collection?.aggregate([{ $match: { id } }, ...STATUS_STAGES, { $project: { _id: 0 } }]);
		const results = await cursor?.toArray();
		return results?.[0] ?? null;
	}

	insert(object: Record<string, unknown>) {
		return this.collection?.insertOne(object as any);
	}

	// `unset`: optional fields removed from the object, which $set alone would keep
	update(id: string, object: Record<string, unknown>, unset: string[] = []) {
		const update: Record<string, any> = { $set: object };
		if (unset.length > 0) update.$unset = Object.fromEntries(unset.map((field) => [field, ""]));
		return this.collection?.updateOne({ id }, update, { upsert: false });
	}

	delete(id: string) {
		return this.collection?.deleteOne({ id });
	}

	pushEvent(objectId: string, event: Record<string, unknown>) {
		return this.collection?.updateOne({ id: objectId }, { $push: { events: event } } as any);
	}

	// `unset`: optional fields removed from the event (e.g. the cause of an event no longer a dispose)
	updateEvent(objectId: string, event: Record<string, unknown> & { id: string }, unset: string[] = []) {
		const setFields = Object.fromEntries(
			Object.entries(event).map(([key, value]) => [`events.$[element].${key}`, value]),
		);
		const update: Record<string, any> = { $set: setFields };
		if (unset.length > 0) {
			update.$unset = Object.fromEntries(unset.map((field) => [`events.$[element].${field}`, ""]));
		}
		return this.collection?.updateOne({ id: objectId }, update, { arrayFilters: [{ "element.id": event.id }] });
	}

	deleteEvent(objectId: string, eventId: string) {
		return this.collection?.updateOne({ id: objectId }, { $pull: { events: { id: eventId } } } as any);
	}
}
