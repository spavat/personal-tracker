import type { SyncResponse } from "@personal-tracker/shared/internet";
import type { FastifyInstance } from "fastify";

import type { ListenedEpisode } from "./sync.entity";

const MONGO_INTERNET_SYNC_COLLECTION = "internet_sync";

export type SyncProposalMongo = SyncResponse[number] & { listened: ListenedEpisode };

export class SyncRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get collection() {
		return this.mongo?.db?.collection<SyncProposalMongo>(MONGO_INTERNET_SYNC_COLLECTION);
	}

	findAll() {
		const cursor = this.collection?.find({}).project({ _id: 0, listened: 0 }).sort({ "origin.datetime": 1 });
		return cursor?.toArray();
	}

	findAllWithSource() {
		return this.collection?.find({}).toArray();
	}

	count() {
		return this.collection?.countDocuments() ?? Promise.resolve(0);
	}

	insertMany(proposals: Array<SyncProposalMongo>) {
		return this.collection?.insertMany(proposals as any);
	}

	replace(proposal: SyncProposalMongo) {
		return this.collection?.replaceOne({ id: proposal.id }, proposal as any);
	}

	delete(id: string) {
		return this.collection?.deleteOne({ id });
	}
}
