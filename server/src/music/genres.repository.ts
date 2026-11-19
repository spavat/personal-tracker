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

	insert(genre: MusicGenre) {
		return this.collection.insertOne(genre);
	}

	update(id: string, genre: Partial<MusicGenre>) {
		return this.collection.updateOne({ id }, { $set: genre });
	}

	delete(id: string) {
		return this.collection.deleteOne({ id });
	}
}
