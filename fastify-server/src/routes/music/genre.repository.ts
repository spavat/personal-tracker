import type { FastifyInstance } from "fastify";

export class GenreRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get collection() {
		return this.mongo?.db?.collection("music_genre");
	}

	findAll() {
		return this.collection?.find({}, { projection: { _id: 0 } }).toArray();
	}

	findById(id: string) {
		return this.collection?.findOne({ id }, { projection: { _id: 0 } });
	}

	insert(genre: Record<string, unknown>) {
		return this.collection?.insertOne(genre as any);
	}

	update(id: string, genre: Record<string, unknown>) {
		return this.collection?.updateOne({ id }, { $set: genre });
	}

	delete(id: string) {
		return this.collection?.deleteOne({ id });
	}
}
