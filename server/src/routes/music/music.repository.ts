import type { FastifyInstance } from "fastify";

export class MusicRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get listenings() {
		return this.mongo?.db?.collection("music_listening");
	}

	findAll({ from, to }: { from?: string; to?: string } = {}) {
		const cursor = this.listenings?.find(
			{
				listeningDate: {
					$gte: from,
					$lte: to,
				},
			},
			{
				projection: { _id: 0 },
				sort: { listeningDate: -1, created: -1 },
			},
		);
		return cursor?.toArray();
	}

	searchListenings(search?: string) {
		const searchRegex = new RegExp((search ?? "").normalize("NFC"), "i");
		const cursor = this.listenings?.aggregate([
			{
				$match: {
					$or: [{ artist: searchRegex }, { album: searchRegex }],
				},
			},
			{
				$group: {
					_id: { artist: "$artist", album: "$album" },
					doc: { $last: "$$ROOT" },
				},
			},
			{
				$replaceRoot: { newRoot: "$doc" },
			},
			{
				$sort: { listeningDate: -1, created: -1 },
			},
		]);
		return cursor?.toArray();
	}

	findById(id: string) {
		return this.listenings?.findOne({ id });
	}

	insert(data: Record<string, unknown>) {
		return this.listenings?.insertOne(data as any);
	}

	update(id: string, data: Record<string, unknown>) {
		// contextTags is left out when empty (see cleanListening): removed from the listening
		return this.listenings?.updateOne(
			{ id },
			{ $set: data, ...(!("contextTags" in data) ? { $unset: { contextTags: "" } } : {}) },
			{ upsert: false },
		);
	}

	delete(id: string) {
		return this.listenings?.deleteOne({ id });
	}
}
