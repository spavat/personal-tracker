import type { FastifyInstance } from "fastify";

const MONGO_INTERNET_SYNC_STATE_COLLECTION = "internet_sync_state";
const GOPODDER_STATE_ID = "gopodder";

interface SyncStateMongo {
	_id: string;
	// gopodder `timestamp` of the last fetch, sent back as `since`
	since: number;
}

export class SyncStateRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get collection() {
		return this.mongo?.db?.collection<SyncStateMongo>(MONGO_INTERNET_SYNC_STATE_COLLECTION);
	}

	async getGopodderSince(): Promise<number | undefined> {
		const state = await this.collection?.findOne({ _id: GOPODDER_STATE_ID });
		return state?.since;
	}

	setGopodderSince(since: number) {
		return this.collection?.updateOne({ _id: GOPODDER_STATE_ID }, { $set: { since } }, { upsert: true });
	}
}
