import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";

import { MONGO_DB } from "../database/database.tokens.js";
import { ContextTag } from "./context-tags.entity.js";

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

	insert(contextTag: ContextTag) {
		return this.collection.insertOne(contextTag);
	}

	update(id: string, contextTag: Omit<ContextTag, "id">) {
		return this.collection.updateOne({ id }, { $set: contextTag });
	}

	delete(id: string) {
		return this.collection.deleteOne({ id });
	}
}
