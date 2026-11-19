import type { LifespanCategory } from "@personal-tracker/shared/lifespan";

import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";

import { MONGO_DB } from "../../database/database.tokens.js";
import { LifespanObjectMongo } from "../objects/objects.entity.js";

@Injectable()
export class LifespanCategoriesRepository {
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	private get categories() {
		return this.db.collection<LifespanCategory>("lifespan_category");
	}

	private get objects() {
		return this.db.collection<LifespanObjectMongo>("lifespan_object");
	}

	findAll() {
		// French collation: "Électroménager" sorts with the E, not after Z
		return this.categories
			.find({}, { projection: { _id: 0 }, sort: { name: 1 }, collation: { locale: "fr" } })
			.toArray();
	}

	findSubCategories(id: string) {
		return this.categories.find({ parentId: id }, { projection: { _id: 0 } }).toArray();
	}

	findObjectsUsingCategory(id: string) {
		return this.objects.find({ categoryId: id }, { projection: { _id: 0 } }).toArray();
	}

	insert(category: LifespanCategory) {
		return this.categories.insertOne(category);
	}

	update(id: string, category: Partial<LifespanCategory>) {
		return this.categories.updateOne({ id }, { $set: category });
	}

	delete(id: string) {
		return this.categories.deleteOne({ id });
	}
}
