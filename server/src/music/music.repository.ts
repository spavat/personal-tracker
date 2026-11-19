import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";

import { MONGO_DB } from "../database/database.tokens.js";
import { accentInsensitiveRegex } from "../database/mongo-search.query.js";
import { StoredListening } from "./music.entity.js";

@Injectable()
export class MusicRepository {
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	private get listenings() {
		return this.db.collection<StoredListening>("music_listening");
	}

	findAll({ from, to, limit }: { from?: string; to?: string; limit?: number } = {}) {
		// an undefined bound would be sent as null and match nothing
		const listeningDate = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
		return this.listenings
			.find(Object.keys(listeningDate).length ? { listeningDate } : {}, {
				projection: { _id: 0 },
				sort: { listeningDate: -1, created: -1 },
				...(limit && { limit }),
			})
			.toArray();
	}

	searchListenings(search?: string) {
		const searchRegex = accentInsensitiveRegex(search ?? "");
		return this.listenings
			.aggregate<StoredListening>([
				{ $match: { $or: [{ artist: searchRegex }, { album: searchRegex }] } },
				{ $group: { _id: { artist: "$artist", album: "$album" }, doc: { $last: "$$ROOT" } } },
				{ $replaceRoot: { newRoot: "$doc" } },
				{ $sort: { listeningDate: -1, created: -1 } },
			])
			.toArray();
	}

	findById(id: string) {
		return this.listenings.findOne({ id });
	}

	// a copy: the driver adds `_id` to the document it inserts
	async insert(listening: StoredListening) {
		await this.listenings.insertOne({ ...listening });
		return listening;
	}

	// the updated listening, null for an unknown id
	update(id: string, data: Partial<StoredListening>) {
		// contextTags is left out when empty (see cleanListening): removed from the listening
		return this.listenings.findOneAndUpdate(
			{ id },
			{ $set: data, ...(!("contextTags" in data) ? { $unset: { contextTags: "" as const } } : {}) },
			{ projection: { _id: 0 }, returnDocument: "after" },
		);
	}

	// false for an unknown id
	async delete(id: string) {
		return (await this.listenings.deleteOne({ id })).deletedCount > 0;
	}
}
