import type { FastifyInstance } from "fastify";

export class SportRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get collection() {
		return this.mongo?.db?.collection("sport");
	}

	findAll({ from, to }: { from?: string; to?: string } = {}) {
		const filter: Record<string, any> = {};
		if (from || to) {
			filter.date = {};
			if (from) filter.date.$gte = from;
			// dates are date-times: everything before the next day
			if (to) filter.date.$lt = Temporal.PlainDate.from(to).add({ days: 1 }).toString();
		}
		const cursor = this.collection?.find(filter, {
			projection: { _id: 0, rawData: 0, points: 0 },
			sort: { date: -1, created: -1 },
		});
		return cursor?.toArray();
	}

	findById(id: string) {
		return this.collection?.findOne({ id }, { projection: { _id: 0, rawData: 0 } });
	}

	findForDownload(id: string) {
		return this.collection?.findOne({ id }, { projection: { _id: 0, name: 1, gpxKey: 1 } });
	}

	findThumbnailKey(id: string) {
		return this.collection?.findOne({ id }, { projection: { _id: 0, thumbnailKey: 1 } });
	}

	insert(activity: Record<string, unknown>) {
		return this.collection?.insertOne(activity as any);
	}

	// `unset`: optional fields removed from the activity, which $set alone would keep
	update(id: string, activity: Record<string, unknown>, unset: string[] = []) {
		const update: Record<string, any> = { $set: activity };
		if (unset.length > 0) update.$unset = Object.fromEntries(unset.map((field) => [field, ""]));
		return this.collection?.updateOne({ id }, update, { upsert: false });
	}

	delete(id: string) {
		return this.collection?.findOneAndDelete({ id });
	}
}
