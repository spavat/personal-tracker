import type { SportActivity } from "@personal-tracker/shared/sport";

import { Inject, Injectable } from "@nestjs/common";
import { Db, Filter, UpdateFilter } from "mongodb";

import { MONGO_DB } from "../database/database.tokens.js";

@Injectable()
export class SportRepository {
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	private get collection() {
		return this.db.collection<SportActivity>("sport");
	}

	findAll({ from, to }: { from?: string; to?: string } = {}) {
		const filter: Filter<SportActivity> = {};
		if (from || to) {
			filter.date = {
				...(from && { $gte: from }),
				// dates are date-times: everything before the next day
				...(to && { $lt: Temporal.PlainDate.from(to).add({ days: 1 }).toString() }),
			};
		}
		return this.collection
			.find(filter, { projection: { _id: 0, rawData: 0, points: 0 }, sort: { date: -1, created: -1 } })
			.toArray();
	}

	findById(id: string) {
		return this.collection.findOne({ id }, { projection: { _id: 0, rawData: 0 } });
	}

	findForDownload(id: string) {
		return this.collection.findOne<Pick<SportActivity, "name" | "gpxKey">>(
			{ id },
			{ projection: { _id: 0, name: 1, gpxKey: 1 } },
		);
	}

	// the images proxy serves the route thumbnail
	findThumbnailKey(id: string) {
		return this.collection.findOne<Pick<SportActivity, "thumbnailKey">>(
			{ id },
			{ projection: { _id: 0, thumbnailKey: 1 } },
		);
	}

	// a copy: the driver adds `_id` to the document it inserts
	async insert(activity: SportActivity) {
		await this.collection.insertOne({ ...activity });
		return activity;
	}

	// the updated activity, null for an unknown id. `unset`: optional fields removed from the activity, which $set
	// alone would keep
	update(id: string, activity: Partial<SportActivity>, unset: string[] = []) {
		const update: UpdateFilter<SportActivity> = { $set: activity };
		if (unset.length > 0) update.$unset = Object.fromEntries(unset.map((field) => [field, ""]));
		return this.collection.findOneAndUpdate({ id }, update, { projection: { _id: 0 }, returnDocument: "after" });
	}

	delete(id: string) {
		return this.collection.findOneAndDelete({ id });
	}
}
