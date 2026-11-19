import type { MusicGenre } from "@personal-tracker/shared/music";

import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";

import { MONGO_DB } from "../database/database.tokens.js";

@Injectable()
export class GenresRepository {
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	private get collection() {
		return this.db.collection<MusicGenre>("music_genre");
	}

	findAll() {
		return this.collection.find({}, { projection: { _id: 0 } }).toArray();
	}

	// a copy: the driver adds `_id` to the document it inserts
	async insert(genre: MusicGenre) {
		await this.collection.insertOne({ ...genre });
		return genre;
	}

	// the updated genre, null for an unknown id
	update(id: string, genre: Partial<MusicGenre>) {
		return this.collection.findOneAndUpdate(
			{ id },
			{ $set: genre },
			{ projection: { _id: 0 }, returnDocument: "after" },
		);
	}

	// false for an unknown id
	async delete(id: string) {
		return (await this.collection.deleteOne({ id })).deletedCount > 0;
	}
}
