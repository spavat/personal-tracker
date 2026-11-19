import { Inject, Injectable } from "@nestjs/common";
import { Db, UpdateFilter } from "mongodb";

import { privacyMatch } from "../common/request-context.js";
import { MONGO_DB } from "../database/database.tokens.js";
import { accentInsensitiveRegex } from "../database/mongo-search.js";
import { EpisodeMongo, ProgramMongo } from "./internet.entity.js";

// Not sent by the episode form when empty (see onSubmitEpisode and cleanEpisode)
const CLEARABLE_EPISODE_FIELDS = ["durationReal", "tags", "contextTags", "ignoredTags"];

interface ProgramListFilters {
	search: string;
	sortField: string;
	sortDirection: string;
}

// Every read hides the private programs from an anonymous visitor (privacyMatch)
@Injectable()
export class InternetRepository {
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	private get collection() {
		return this.db.collection<ProgramMongo>("internet");
	}

	findAll({ search, sortField, sortDirection }: ProgramListFilters) {
		return this.collection
			.aggregate<ProgramMongo>([
				{
					$match: {
						...privacyMatch(),
						$or: [
							{ name: accentInsensitiveRegex(search) },
							{ author: accentInsensitiveRegex(search) },
							{ network: accentInsensitiveRegex(search) },
						],
					},
				},
				{
					$addFields: {
						episodeCount: { $size: "$episodes" },
						totalDuration: { $sum: "$episodes.duration" },
						latestEpisodeDate: { $max: { $ifNull: ["$episodes.date", []] } },
						latestEpisodeCreated: { $max: { $ifNull: ["$episodes.created", []] } },
					},
				},
				{ $project: { _id: 0, episodes: 0 } },
				{ $sort: { [sortField]: sortDirection === "asc" ? 1 : -1, latestEpisodeCreated: -1 } },
			])
			.toArray();
	}

	// The programs with an episode in the period, each keeping only those episodes
	findEpisodesInRange({ from, to }: { from?: string; to?: string } = {}) {
		return this.collection
			.aggregate<ProgramMongo>([
				{ $match: { ...privacyMatch(), episodes: { $elemMatch: { date: { $gte: from, $lte: to } } } } },
				{
					$set: {
						episodes: {
							$filter: {
								input: "$episodes",
								as: "episode",
								cond: { $and: [{ $gte: ["$$episode.date", from] }, { $lte: ["$$episode.date", to] }] },
							},
						},
					},
				},
				{
					$set: {
						latestEpisodeDate: { $max: { $ifNull: ["$episodes.date", []] } },
						latestEpisodeCreated: { $max: { $ifNull: ["$episodes.created", []] } },
					},
				},
				{ $project: { _id: 0, refs: 0, links: 0, description: 0 } },
				{ $sort: { latestEpisodeDate: -1, latestEpisodeCreated: -1 } },
			])
			.toArray();
	}

	// The programs of the most recent episodes across all the programs, each keeping only those episodes
	// (oldest first, like findEpisodesInRange), the program of the latest episode first (home page)
	findLatestEpisodes(limit: number) {
		return this.collection
			.aggregate<ProgramMongo>([
				{ $match: { ...privacyMatch() } },
				{ $unwind: "$episodes" },
				{ $sort: { "episodes.date": -1, "episodes.created": -1 } },
				{ $limit: limit },
				{
					$group: {
						_id: "$id",
						program: { $first: "$$ROOT" },
						episodes: { $push: "$episodes" },
						latestEpisodeDate: { $first: "$episodes.date" },
						latestEpisodeCreated: { $first: "$episodes.created" },
					},
				},
				{ $sort: { latestEpisodeDate: -1, latestEpisodeCreated: -1 } },
				{
					$replaceRoot: {
						newRoot: { $mergeObjects: ["$program", { episodes: { $reverseArray: "$episodes" } }] },
					},
				},
				{ $project: { _id: 0, refs: 0, links: 0, description: 0 } },
			])
			.toArray();
	}

	findAllWithEpisodes() {
		return this.collection
			.find({ ...privacyMatch() })
			.project<Pick<ProgramMongo, "id" | "name" | "shortName" | "tags" | "episodes">>({
				_id: 0,
				id: 1,
				name: 1,
				shortName: 1,
				tags: 1,
				episodes: 1,
			})
			.toArray();
	}

	findById(id: string) {
		return this.collection.findOne({ ...privacyMatch(), id });
	}

	findByRssUrl(rssUrl: string) {
		return this.collection.findOne({ ...privacyMatch(), "refs.rss": rssUrl });
	}

	findChannelsByYoutubeChannelId(channelId: string) {
		return this.collection
			.find({ ...privacyMatch(), "refs.youtubeChannelId": channelId })
			.project({ id: 1, name: 1, author: 1, network: 1 })
			.toArray();
	}

	findChannelsByUrl(url: string) {
		return this.collection
			.find({ ...privacyMatch(), links: url })
			.project({ id: 1, name: 1, author: 1, network: 1 })
			.toArray();
	}

	findProgramsWithYoutubeChannel() {
		return this.collection
			.find({
				...privacyMatch(),
				"refs.youtubeChannelId": { $exists: true, $ne: "" },
				$or: [{ profile: { $exists: false } }, { banner: { $exists: false } }],
			})
			.toArray();
	}

	findProgramsWithRssFeed() {
		return this.collection
			.find({
				...privacyMatch(),
				"refs.rss": { $exists: true, $ne: "" },
				"refs.youtubeChannelId": { $exists: false },
				profile: { $exists: false },
			})
			.toArray();
	}

	insertProgram(program: ProgramMongo) {
		return this.collection.insertOne(program);
	}

	updateProgram(id: string, program: Partial<ProgramMongo>) {
		return this.collection.updateOne({ id }, { $set: program }, { upsert: false });
	}

	setRssRef(programId: string, rssUrl: string) {
		return this.collection.updateOne({ id: programId }, { $set: { "refs.rss": rssUrl } });
	}

	pushEpisode(programId: string, episode: EpisodeMongo) {
		return this.collection.updateOne({ id: programId }, { $push: { episodes: episode } });
	}

	updateEpisode(programId: string, episode: Partial<EpisodeMongo> & { id: string }) {
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
		const update: UpdateFilter<ProgramMongo> = { $set: setFields };
		if (Object.keys(unsetFields).length > 0) update.$unset = unsetFields;

		return this.collection.updateOne({ id: programId }, update, { arrayFilters: [{ "element.id": episode.id }] });
	}

	deleteEpisode(programId: string, episodeId: string) {
		return this.collection.updateOne({ id: programId }, { $pull: { episodes: { id: episodeId } } });
	}

	// Same filtering as findEpisodesInRange, sorted by latest episode
	findStatsRaw({ from, to }: { from?: string; to?: string } = {}) {
		return this.collection
			.aggregate<ProgramMongo>([
				{ $match: { ...privacyMatch(), episodes: { $elemMatch: { date: { $gte: from, $lte: to } } } } },
				{
					$set: {
						episodes: {
							$filter: {
								input: "$episodes",
								as: "episode",
								cond: { $and: [{ $gte: ["$$episode.date", from] }, { $lte: ["$$episode.date", to] }] },
							},
						},
					},
				},
				{ $set: { latestEpisodeDate: { $max: { $ifNull: ["$episodes.date", []] } } } },
				{ $sort: { latestEpisodeDate: -1 } },
			])
			.toArray();
	}
}
