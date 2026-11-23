import type { SyncResponse } from "@personal-tracker/shared/broadcast";

import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";

import type { ListenedEpisode } from "./sync.entity.js";

import { MONGO_DB } from "../../database/database.tokens.js";

// A listened episode (from an AntennaPod backup or gopodder) and what it matches in the programs
export type SyncProposalMongo = SyncResponse[number] & { listened: ListenedEpisode };

@Injectable()
export class SyncRepository {
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	private get collection() {
		return this.db.collection<SyncProposalMongo>("broadcast_sync");
	}

	findAll() {
		return this.collection
			.find({})
			.project<SyncResponse[number]>({ _id: 0, listened: 0 })
			.sort({ "origin.datetime": 1 })
			.toArray();
	}

	findAllWithSource() {
		return this.collection.find({}).toArray();
	}

	findByPodcastUrl(podcastUrl: string) {
		return this.collection.find({ "listened.podcastUrl": podcastUrl }).toArray();
	}

	findWithoutProposition() {
		return this.collection.find({ proposition: { $exists: false } }).toArray();
	}

	deleteByPodcastUrl(podcastUrl: string) {
		return this.collection.deleteMany({ "listened.podcastUrl": podcastUrl });
	}

	count() {
		return this.collection.countDocuments();
	}

	insertMany(proposals: Array<SyncProposalMongo>) {
		return this.collection.insertMany(proposals);
	}

	replace(proposal: SyncProposalMongo) {
		return this.collection.replaceOne({ id: proposal.id }, proposal);
	}

	// false for an unknown id
	async delete(id: string) {
		return (await this.collection.deleteOne({ id })).deletedCount > 0;
	}
}
