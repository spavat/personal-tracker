import { Inject, Injectable } from "@nestjs/common";
import { Db, UpdateFilter } from "mongodb";

import { MONGO_DB } from "../../database/database.tokens.js";
import { accentInsensitiveRegex } from "../../database/mongo-search.js";
import { LifespanEventMongo, LifespanObjectMongo, LifespanObjectWithStatusMongo } from "./objects.entity.js";

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

@Injectable()
export class LifespanObjectsRepository {
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	private get collection() {
		return this.db.collection<LifespanObjectMongo>("lifespan_object");
	}

	findAll({ search, categoryId, sortField, sortDirection }: LifespanObjectListFilters) {
		return this.collection
			.aggregate<LifespanObjectWithStatusMongo>([
				{
					$match: {
						...(search ? { name: accentInsensitiveRegex(search) } : {}),
						...(categoryId ? { categoryId } : {}),
					},
				},
				...STATUS_STAGES,
				{ $project: { _id: 0 } },
				{ $sort: { [sortField]: sortDirection === "asc" ? 1 : -1 } },
			])
			.toArray();
	}

	async findById(id: string) {
		const [object] = await this.collection
			.aggregate<LifespanObjectWithStatusMongo>([{ $match: { id } }, ...STATUS_STAGES, { $project: { _id: 0 } }])
			.toArray();
		return object ?? null;
	}

	insert(object: LifespanObjectMongo) {
		return this.collection.insertOne(object);
	}

	// `unset`: optional fields removed from the object, which $set alone would keep
	update(id: string, object: Partial<LifespanObjectMongo>, unset: string[] = []) {
		const update: UpdateFilter<LifespanObjectMongo> = { $set: object };
		if (unset.length > 0) update.$unset = Object.fromEntries(unset.map((field) => [field, ""]));
		return this.collection.updateOne({ id }, update, { upsert: false });
	}

	delete(id: string) {
		return this.collection.deleteOne({ id });
	}

	pushEvent(objectId: string, event: LifespanEventMongo) {
		return this.collection.updateOne({ id: objectId }, { $push: { events: event } });
	}

	// `unset`: optional fields removed from the event (e.g. the cause of an event no longer a dispose)
	updateEvent(objectId: string, event: LifespanEventMongo, unset: string[] = []) {
		const setFields = Object.fromEntries(
			Object.entries(event).map(([key, value]) => [`events.$[element].${key}`, value]),
		);
		const update: UpdateFilter<LifespanObjectMongo> = { $set: setFields };
		if (unset.length > 0) {
			update.$unset = Object.fromEntries(unset.map((field) => [`events.$[element].${field}`, ""]));
		}
		return this.collection.updateOne({ id: objectId }, update, { arrayFilters: [{ "element.id": event.id }] });
	}

	deleteEvent(objectId: string, eventId: string) {
		return this.collection.updateOne({ id: objectId }, { $pull: { events: { id: eventId } } });
	}
}
