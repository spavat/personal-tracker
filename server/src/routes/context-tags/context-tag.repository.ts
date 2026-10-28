import type { FastifyInstance } from "fastify";

export class ContextTagRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get collection() {
		return this.mongo?.db?.collection("context_tags");
	}

	findAll() {
		return this.collection
			?.find({}, { projection: { _id: 0 }, sort: { name: 1 }, collation: { locale: "fr" } })
			.toArray();
	}

	findById(id: string) {
		return this.collection?.findOne({ id }, { projection: { _id: 0 } });
	}

	insert(contextTag: Record<string, unknown>) {
		return this.collection?.insertOne(contextTag as any);
	}

	update(id: string, contextTag: Record<string, unknown>) {
		return this.collection?.updateOne({ id }, { $set: contextTag });
	}

	delete(id: string) {
		return this.collection?.deleteOne({ id });
	}
}
