import type { FastifyInstance } from "fastify";

export class LifespanCategoryRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get categories() {
		return this.mongo?.db?.collection("lifespan_category");
	}

	private get objects() {
		return this.mongo?.db?.collection("lifespan_object");
	}

	findAll() {
		// French collation: "Électroménager" sorts with the E, not after Z
		return this.categories
			?.find({}, { projection: { _id: 0 }, sort: { name: 1 }, collation: { locale: "fr" } })
			.toArray();
	}

	findById(id: string) {
		return this.categories?.findOne({ id }, { projection: { _id: 0 } });
	}

	findSubCategories(id: string) {
		return this.categories?.find({ parentId: id }, { projection: { _id: 0 } }).toArray();
	}

	findObjectsUsingCategory(id: string) {
		return this.objects?.find({ categoryId: id }, { projection: { _id: 0 } }).toArray();
	}

	insert(category: Record<string, unknown>) {
		return this.categories?.insertOne(category as any);
	}

	update(id: string, category: Record<string, unknown>) {
		return this.categories?.updateOne({ id }, { $set: category });
	}

	delete(id: string) {
		return this.categories?.deleteOne({ id });
	}
}
