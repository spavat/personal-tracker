import type { FastifyInstance } from "fastify";

import type { ProgramMongo } from "./internet.entity";

const MONGO_INTERNET_COLLECTION = "internet";
// Not sent by the episode form when empty (see onSubmitEpisode and cleanEpisode)
const CLEARABLE_EPISODE_FIELDS = ["durationReal", "tags", "contextTags"];

interface ProgramListFilters {
	search: string;
	sortField: string;
	sortDirection: string;
}

export class InternetRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get collection() {
		return this.mongo?.db?.collection<ProgramMongo>(MONGO_INTERNET_COLLECTION);
	}

	findAll({ search, sortField, sortDirection }: ProgramListFilters) {
		const cursor = this.collection?.aggregate([
			{
				$match: {
					$or: [
						{ name: new RegExp(`${search.normalize("NFC")}`, "i") },
						{ author: new RegExp(`${search.normalize("NFC")}`, "i") },
						{ network: new RegExp(`${search.normalize("NFC")}`, "i") },
					],
				},
			},
			{
				$addFields: {
					episodeCount: { $size: "$episodes" },
					totalDuration: { $sum: "$episodes.duration" },
					latestEpisodeDate: {
						$max: {
							$ifNull: ["$episodes.date", []],
						},
					},
					latestEpisodeCreated: {
						$max: {
							$ifNull: ["$episodes.created", []],
						},
					},
				},
			},
			{
				$project: {
					_id: 0,
					episodes: 0,
				},
			},
			{
				$sort: {
					[sortField]: sortDirection === "asc" ? 1 : -1,
					latestEpisodeCreated: -1,
				},
			},
		]);
		return cursor?.toArray();
	}

	findEpisodesInRange({ from, to }: { from?: string; to?: string } = {}) {
		const cursor = this.collection?.aggregate([
			{
				// 1️⃣ Keep only programs with at least one episode in the period
				$match: {
					episodes: {
						$elemMatch: {
							date: {
								$gte: from,
								$lte: to,
							},
						},
					},
				},
			},
			{
				// 2️⃣ Replace episodes array without touching other fields
				$set: {
					episodes: {
						$filter: {
							input: "$episodes",
							as: "episode",
							cond: {
								$and: [{ $gte: ["$$episode.date", from] }, { $lte: ["$$episode.date", to] }],
							},
						},
					},
				},
			},
			{
				// 3️⃣ Compute latest episode date per channel
				$set: {
					latestEpisodeDate: {
						$max: {
							$ifNull: ["$episodes.date", []],
						},
					},
					latestEpisodeCreated: {
						$max: {
							$ifNull: ["$episodes.created", []],
						},
					},
				},
			},
			{
				$project: {
					_id: 0,
					refs: 0,
					links: 0,
					description: 0,
				},
			},
			{
				// 4️⃣ Sort channels by latest episode (most recent first)
				$sort: {
					latestEpisodeDate: -1,
					latestEpisodeCreated: -1,
				},
			},
		]);
		return cursor?.toArray();
	}

	findById(id: string) {
		return this.collection?.findOne({ id });
	}

	findByRssUrl(rssUrl: string) {
		return this.collection?.findOne({ "refs.rss": rssUrl } as any);
	}

	findChannelsByYoutubeChannelId(channelId: string) {
		const cursor = this.collection
			?.find({ "refs.youtubeChannelId": channelId } as any)
			.project({ id: 1, name: 1, author: 1, network: 1 });
		return cursor?.toArray();
	}

	findChannelsByUrl(url: string) {
		const cursor = this.collection?.find({ links: url } as any).project({ id: 1, name: 1, author: 1, network: 1 });
		return cursor?.toArray();
	}

	findProgramsWithYoutubeChannel() {
		const cursor = this.collection?.find({
			"refs.youtubeChannelId": { $exists: true, $ne: "" },
			$or: [{ profile: { $exists: false } }, { banner: { $exists: false } }],
		} as any);
		return cursor?.toArray();
	}

	findProgramsWithRssFeed() {
		const cursor = this.collection?.find({
			"refs.rss": { $exists: true, $ne: "" },
			"refs.youtubeChannelId": { $exists: false },
			profile: { $exists: false },
		} as any);
		return cursor?.toArray();
	}

	insertProgram(program: Record<string, unknown>) {
		return this.collection?.insertOne(program as any);
	}

	updateProgram(id: string, program: Record<string, unknown>) {
		return this.collection?.updateOne({ id }, { $set: program as any }, { upsert: false });
	}

	pushEpisode(programId: string, episode: Record<string, unknown>) {
		return this.collection?.updateOne({ id: programId }, { $push: { episodes: episode } } as any);
	}

	updateEpisode(programId: string, episode: Record<string, unknown> & { id: string }) {
		// Transform episode fields to dot notation
		const setFields = Object.fromEntries(
			Object.entries(episode).map(([key, value]) => [`episodes.$[element].${key}`, value]),
		);
		// Optional fields left out of the payload have been cleared in the form
		const unsetFields = Object.fromEntries(
			CLEARABLE_EPISODE_FIELDS.filter((key) => !(key in episode)).map((key) => [
				`episodes.$[element].${key}`,
				"" as const,
			]),
		);

		return this.collection?.updateOne(
			{ id: programId },
			{ $set: setFields, ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}) },
			{ arrayFilters: [{ "element.id": episode.id }] },
		);
	}

	deleteEpisode(programId: string, episodeId: string) {
		return this.collection?.updateOne({ id: programId }, { $pull: { episodes: { id: episodeId } } });
	}

	findStatsRaw({ from, to }: { from?: string; to?: string } = {}) {
		const cursor = this.collection?.aggregate([
			{
				// 1️⃣ Keep only channels with at least one episode in 2026
				$match: {
					episodes: {
						$elemMatch: {
							date: {
								$gte: from,
								$lte: to,
							},
						},
					},
				},
			},
			{
				// 2️⃣ Replace episodes array without touching other fields
				$set: {
					episodes: {
						$filter: {
							input: "$episodes",
							as: "episode",
							cond: {
								$and: [{ $gte: ["$$episode.date", from] }, { $lte: ["$$episode.date", to] }],
							},
						},
					},
				},
			},
			{
				// 3️⃣ Compute latest episode date per channel
				$set: {
					latestEpisodeDate: {
						$max: {
							$ifNull: ["$episodes.date", []],
						},
					},
				},
			},
			{
				// 4️⃣ Sort channels by latest episode (most recent first)
				$sort: {
					latestEpisodeDate: -1,
				},
			},
		]);
		return cursor?.toArray();
	}
}
