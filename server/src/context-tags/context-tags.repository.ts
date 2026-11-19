import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";

import { MONGO_DB } from "../database/database.tokens.js";
import { ContextTag } from "./context-tag.entity.js";

@Injectable()
export class ContextTagsRepository {
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	private get collection() {
		return this.db.collection<ContextTag>("context_tags");
	}

	findAll() {
		return this.collection
			.find({}, { projection: { _id: 0 }, sort: { name: 1 }, collation: { locale: "fr" } })
			.toArray();
	}

	findById(id: string) {
		return this.collection.findOne({ id }, { projection: { _id: 0 } });
	}

	// a copy: the driver adds `_id` to the document it inserts
	async insert(contextTag: ContextTag) {
		await this.collection.insertOne({ ...contextTag });
		return contextTag;
	}

	// the updated tag, null for an unknown id
	update(id: string, contextTag: Omit<ContextTag, "id">) {
		return this.collection.findOneAndUpdate(
			{ id },
			{ $set: contextTag },
			{ projection: { _id: 0 }, returnDocument: "after" },
		);
	}

	// false for an unknown id
	async delete(id: string) {
		return (await this.collection.deleteOne({ id })).deletedCount > 0;
	}
}
