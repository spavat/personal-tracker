import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";

import { MONGO_DB } from "../../database/database.tokens.js";

const GOPODDER_STATE_ID = "gopodder";

interface SyncStateMongo {
	_id: string;
	// gopodder `timestamp` of the last fetch, sent back as `since`
	since: number;
}

@Injectable()
export class SyncStateRepository {
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	private get collection() {
		return this.db.collection<SyncStateMongo>("broadcast_sync_state");
	}

	async getGopodderSince(): Promise<number | undefined> {
		return (await this.collection.findOne({ _id: GOPODDER_STATE_ID }))?.since;
	}

	setGopodderSince(since: number) {
		return this.collection.updateOne({ _id: GOPODDER_STATE_ID }, { $set: { since } }, { upsert: true });
	}
}
