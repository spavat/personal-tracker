import { Inject, Injectable } from "@nestjs/common";
import {
	type EpisodeCredit,
	type EpisodeCreditRole,
	type EpisodeStatus,
	type Format,
	matchFormat,
	type ProgramCredit,
	type ProgramCreditRole,
} from "@personal-tracker/shared/broadcast";
import {
	and,
	type AnyColumn,
	asc,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	lte,
	ne,
	notInArray,
	or,
	sql,
	type SQL,
} from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { Drizzle } from "../database/drizzle.js";
import type { CatalogEpisode } from "./sources/episode-feed.client.js";

import { viewerIsOwner } from "../common/request-context.js";
import { contains } from "../database/contains.query.js";
import { moveCredits } from "../database/credit.query.js";
import { DRIZZLE } from "../database/database.tokens.js";
import { createNode, renameNode, type Tx } from "../database/node.query.js";
import {
	broadcastEpisode,
	broadcastEpisodeContributor,
	broadcastFormat,
	broadcastProgram,
	broadcastProgramContributor,
	broadcastSeason,
	broadcastView,
	coreEntity,
	coreNode,
} from "../database/schema.js";
import { type EpisodeDoc, episodeCoverUrl, type ProgramDoc, type ViewDoc } from "./broadcast.entity.js";
import { youtubeVideoId } from "./sources/youtube-link.utils.js";

// Between the names of `author` / `network`
const PROGRAM_SEPARATOR = "&";

// A program's own fields (its credits are saved apart)
export type ProgramFields = Omit<ProgramDoc, "episodes" | "credits" | "author" | "network" | "tracking"> &
	Partial<Pick<ProgramDoc, "tracking">>;
// A credit as it is saved: the entity, its role, the name given when it differs
export type SaveCredit<R> = { entityId: string; role: R; creditedAs: string | null };
// `coverKey`: the S3 key of its cover (null: none; left out on a new view of a stored episode: kept)
export type EpisodeFields = Omit<EpisodeDoc, "id" | "views" | "credits" | "cover"> & {
	coverKey?: string | null;
	credits?: SaveCredit<EpisodeCreditRole>[];
};
// An imported episode whose cover is to be downloaded
export type CoverToImport = { episodeId: string; source: string };
export type ViewFields = Omit<ViewDoc, "id" | "created">;

interface ProgramListFilters {
	search: string;
	sortField: string;
	sortDirection: string;
}
interface Period {
	from?: string;
	to?: string;
}
type ProgramRow = typeof broadcastProgram.$inferSelect;
type EpisodeRow = typeof broadcastEpisode.$inferSelect;
type ViewRow = typeof broadcastView.$inferSelect;
type Credits = { author?: string; network?: string; credits: ProgramCredit[] };

// What the list answers on top of the program
type ProgramSummary = Omit<ProgramDoc, "episodes"> & {
	episodeCount: number;
	totalDuration: number;
	latestEpisodeDate: string | null;
	latestEpisodeCreated: string | null;
};

// Optional values are left out of the answers when empty
function present<T>(value: T | null | undefined) {
	return value === null || value === undefined || (Array.isArray(value) && value.length === 0) ? undefined : value;
}

function toProgramDoc(row: ProgramRow, credits: Credits, episodes: EpisodeDoc[]): ProgramDoc {
	const refs: Record<string, string> = Object.fromEntries(
		Object.entries({
			rss: row.rss,
			youtubeChannelId: row.youtubeChannelId,
			youtubePlaylistId: row.youtubePlaylistId,
		}).flatMap(([key, value]) => (value ? [[key, value]] : [])),
	);
	return {
		id: row.id,
		name: row.name,
		shortName: present(row.shortName),
		author: credits.author,
		country: present(row.country),
		network: credits.network,
		tracking: row.tracking,
		credits: credits.credits,
		links: present(row.links),
		profile: present(row.profileKey),
		banner: present(row.bannerKey),
		episodes,
		tags: present(row.tags),
		refs: Object.keys(refs).length ? refs : undefined,
		description: present(row.description),
		type: present(row.type),
		private: row.private || undefined,
	};
}

function toViewDoc(view: ViewRow): ViewDoc {
	return {
		id: view.id,
		date: view.date,
		duration: present(view.duration),
		contextTags: present(view.contextTags),
		comment: present(view.comment),
		created: view.createdAt,
	};
}

function toEpisodeDoc(episode: EpisodeRow, views: ViewDoc[], credits: EpisodeCredit[] = []): EpisodeDoc {
	return {
		id: episode.id,
		name: episode.name,
		shortName: present(episode.shortName),
		duration: episode.duration ?? 0,
		type: episode.type ?? "",
		releaseDate: present(episode.releaseDate),
		link: present(episode.link),
		tags: present(episode.tags),
		ignoredTags: present(episode.ignoredTags),
		externalId: present(episode.externalId),
		seasonId: present(episode.seasonId),
		formatId: present(episode.formatId),
		position: present(episode.position),
		numberLabel: present(episode.numberLabel),
		status: present(episode.status),
		description: present(episode.description),
		cover: episodeCoverUrl(episode.id, episode.coverKey),
		credits,
		views,
	};
}

// The columns of a saved episode / view: every field is written, a field left out is cleared
function episodeColumns(fields: EpisodeFields) {
	return {
		name: fields.name,
		shortName: fields.shortName || null,
		duration: fields.duration || null,
		type: fields.type || null,
		releaseDate: fields.releaseDate || null,
		link: fields.link || null,
		externalId: fields.externalId || null,
		seasonId: fields.seasonId || null,
		formatId: fields.formatId || null,
		position: fields.position ?? null,
		numberLabel: fields.numberLabel || null,
		description: fields.description || null,
		coverKey: fields.coverKey ?? null,
		tags: fields.tags ?? [],
		ignoredTags: fields.ignoredTags ?? [],
	};
}
// Only the columns of the fields given (an existing episode getting a new view keeps the others)
function givenEpisodeColumns(fields: EpisodeFields) {
	return Object.fromEntries(
		Object.entries(episodeColumns(fields)).filter(([key]) => fields[key as keyof EpisodeFields] !== undefined),
	);
}
function viewColumns(fields: ViewFields) {
	return {
		date: fields.date,
		duration: fields.duration ?? null,
		contextTags: fields.contextTags ?? [],
		comment: fields.comment || null,
	};
}

// The program's own columns among the fields of a program document (left out = unchanged)
function programFields(doc: Partial<ProgramDoc>) {
	const fields: Partial<typeof broadcastProgram.$inferInsert> = {};
	if (doc.name !== undefined) fields.name = doc.name;
	if (doc.shortName !== undefined) fields.shortName = doc.shortName || null;
	if (doc.country !== undefined) fields.country = doc.country || null;
	if (doc.description !== undefined) fields.description = doc.description || null;
	if (doc.type !== undefined) fields.type = doc.type || null;
	if (doc.links !== undefined) fields.links = doc.links;
	if (doc.tags !== undefined) fields.tags = doc.tags;
	if (doc.private !== undefined) fields.private = doc.private;
	if (doc.tracking !== undefined) fields.tracking = doc.tracking;
	if (doc.profile !== undefined) fields.profileKey = doc.profile || null;
	if (doc.banner !== undefined) fields.bannerKey = doc.banner || null;
	if (doc.refs !== undefined) {
		fields.rss = doc.refs.rss || null;
		fields.youtubeChannelId = doc.refs.youtubeChannelId || null;
		fields.youtubePlaylistId = doc.refs.youtubePlaylistId || null;
	}
	return fields;
}

// The collation the Mongo collection had: French, accents and case compared, punctuation not ignored
const collator = new Intl.Collator("fr");

// Absent values sort first ascending, as Mongo sorted them
function compareValues(a: unknown, b: unknown) {
	if (a === b) return 0;
	if (a === null || a === undefined) return -1;
	if (b === null || b === undefined) return 1;
	if (typeof a === "number" && typeof b === "number") return a - b;
	return collator.compare(String(a), String(b));
}

// The view watched last of a program: by date, then by creation
function lastView(doc: ProgramDoc) {
	return doc.episodes
		.flatMap(({ views }) => views)
		.toSorted((a, b) => -compareValues(a.date, b.date) || -compareValues(a.created, b.created))[0];
}

// Each credit with its position among the credits of the same role (a name given twice is credited once)
function withOrder<R extends string>(credits: SaveCredit<R>[]) {
	const next = new Map<R, number>();
	return credits.map((credit) => {
		const order = next.get(credit.role) ?? 0;
		next.set(credit.role, order + 1);
		return { ...credit, order };
	});
}

// Rows per insert of an import (Postgres takes 65535 parameters per statement)
const IMPORT_CHUNK = 500;

// The label of the season an import creates for `itunes:season` N
const seasonLabel = (season: number) => `Saison ${season}`;

// The views of a period
const inPeriod = ({ from, to }: Period) =>
	and(from ? gte(broadcastView.date, from) : undefined, to ? lte(broadcastView.date, to) : undefined);

// Lists leave out what they don't show
const withoutDetails = ({ refs: _refs, links: _links, description: _description, ...doc }: ProgramDoc) => doc;

// Every read hides the private programs from an anonymous visitor
@Injectable()
export class BroadcastRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

	private visible() {
		return viewerIsOwner() ? undefined : eq(broadcastProgram.private, false);
	}

	private selectPrograms(where?: SQL) {
		return this.db.select().from(broadcastProgram).where(and(this.visible(), where));
	}

	// The credits of the programs in credit order; author = the names of the host and producer ones, network = of
	// the network ones
	private async loadCredits(programIds: string[]) {
		const credits = new Map<string, Credits>();
		if (!programIds.length) return credits;
		const rows = await this.db
			.select({
				programId: broadcastProgramContributor.programId,
				entityId: broadcastProgramContributor.entityId,
				role: broadcastProgramContributor.role,
				creditedAs: broadcastProgramContributor.creditedAs,
				name: coreEntity.name,
				kind: coreEntity.kind,
			})
			.from(broadcastProgramContributor)
			.innerJoin(coreEntity, eq(coreEntity.id, broadcastProgramContributor.entityId))
			.where(inArray(broadcastProgramContributor.programId, programIds))
			.orderBy(
				broadcastProgramContributor.programId,
				broadcastProgramContributor.role,
				broadcastProgramContributor.order,
			);
		for (const { programId, ...credit } of rows) {
			const entry = credits.get(programId) ?? { credits: [] };
			entry.credits.push(credit);
			credits.set(programId, entry);
		}
		const joined = (list: ProgramCredit[]) =>
			list.length
				? list.map((credit) => credit.creditedAs ?? credit.name).join(` ${PROGRAM_SEPARATOR} `)
				: undefined;
		for (const entry of credits.values()) {
			entry.author = joined(entry.credits.filter(({ role }) => role !== "network"));
			entry.network = joined(entry.credits.filter(({ role }) => role === "network"));
		}
		return credits;
	}

	// Fills the credits of these episodes, in credit order
	private async loadEpisodeCredits(episodes: EpisodeDoc[]) {
		if (!episodes.length) return;
		const rows = await this.db
			.select({
				episodeId: broadcastEpisodeContributor.episodeId,
				entityId: broadcastEpisodeContributor.entityId,
				role: broadcastEpisodeContributor.role,
				creditedAs: broadcastEpisodeContributor.creditedAs,
				name: coreEntity.name,
				kind: coreEntity.kind,
			})
			.from(broadcastEpisodeContributor)
			.innerJoin(coreEntity, eq(coreEntity.id, broadcastEpisodeContributor.entityId))
			.where(
				inArray(
					broadcastEpisodeContributor.episodeId,
					episodes.map(({ id }) => id),
				),
			)
			.orderBy(broadcastEpisodeContributor.role, broadcastEpisodeContributor.order);
		const byId = new Map(episodes.map((episode) => [episode.id, episode]));
		for (const { episodeId, ...credit } of rows) byId.get(episodeId)?.credits.push(credit);
	}

	// The episodes of these programs with their views (oldest first), in the order of their first view. With a
	// period: only its views, and only the episodes having one.
	private async loadEpisodes(programIds: string[], period?: Period) {
		const episodes = new Map<string, EpisodeDoc[]>();
		if (!programIds.length) return episodes;
		const rows = await this.db
			.select({ episode: broadcastEpisode, view: broadcastView })
			.from(broadcastEpisode)
			.leftJoin(
				broadcastView,
				and(eq(broadcastView.episodeId, broadcastEpisode.id), period ? inPeriod(period) : undefined),
			)
			.where(
				and(inArray(broadcastEpisode.programId, programIds), period ? isNotNull(broadcastView.id) : undefined),
			)
			.orderBy(asc(broadcastView.date), asc(broadcastView.createdAt));
		const byId = new Map<string, EpisodeDoc>();
		for (const { episode, view } of rows) {
			let doc = byId.get(episode.id);
			if (!doc) {
				doc = toEpisodeDoc(episode, []);
				byId.set(episode.id, doc);
				episodes.set(episode.programId, [...(episodes.get(episode.programId) ?? []), doc]);
			}
			if (view) doc.views.push(toViewDoc(view));
		}
		await this.loadEpisodeCredits([...byId.values()]);
		return episodes;
	}

	private async toDocs(rows: ProgramRow[], episodes?: Map<string, EpisodeDoc[]>) {
		const credits = await this.loadCredits(rows.map(({ id }) => id));
		return rows.map((row) =>
			toProgramDoc(row, credits.get(row.id) ?? { credits: [] }, episodes?.get(row.id) ?? []),
		);
	}

	private async findOne(where: SQL) {
		const [row] = await this.selectPrograms(where).limit(1);
		if (!row) return null;
		const [doc] = await this.toDocs([row], await this.loadEpisodes([row.id]));
		return doc;
	}

	async findAll({ search, sortField, sortDirection }: ProgramListFilters): Promise<ProgramSummary[]> {
		const credited = this.db
			.select({ id: broadcastProgramContributor.programId })
			.from(broadcastProgramContributor)
			.innerJoin(coreEntity, eq(coreEntity.id, broadcastProgramContributor.entityId))
			.where(or(contains(coreEntity.name, search), contains(broadcastProgramContributor.creditedAs, search)));
		const rows = await this.selectPrograms(
			search ? or(contains(broadcastProgram.name, search), inArray(broadcastProgram.id, credited)) : undefined,
		);
		const totals = await this.db
			.select({
				programId: broadcastEpisode.programId,
				episodeCount: sql<number>`count(*)::int`,
				totalDuration: sql<number>`coalesce(sum(${broadcastEpisode.duration}), 0)::int`,
				latestEpisodeDate: sql<string>`to_char(max(${broadcastView.date}), 'YYYY-MM-DD')`,
				latestEpisodeCreated: sql<string>`max(${broadcastView.createdAt})::text`,
			})
			.from(broadcastView)
			.innerJoin(broadcastEpisode, eq(broadcastEpisode.id, broadcastView.episodeId))
			.groupBy(broadcastEpisode.programId);
		const totalsOf = new Map(totals.map((total) => [total.programId, total]));

		const direction = sortDirection === "asc" ? 1 : -1;
		return (await this.toDocs(rows))
			.map(({ episodes: _episodes, ...program }) => {
				const total = totalsOf.get(program.id);
				return {
					...program,
					episodeCount: total?.episodeCount ?? 0,
					totalDuration: total?.totalDuration ?? 0,
					latestEpisodeDate: total?.latestEpisodeDate ?? null,
					latestEpisodeCreated: total?.latestEpisodeCreated ?? null,
				};
			})
			.toSorted(
				(a, b) =>
					direction * compareValues(a[sortField as keyof typeof a], b[sortField as keyof typeof b]) ||
					-compareValues(a.latestEpisodeCreated, b.latestEpisodeCreated),
			);
	}

	// The entity's program credits (by program name) and episode credits (latest release first, each episode with its
	// views), one per role
	async findEntityCredits(entityId: string) {
		const programs = await this.db
			.select({
				id: broadcastProgram.id,
				name: broadcastProgram.name,
				profileKey: broadcastProgram.profileKey,
				role: broadcastProgramContributor.role,
				creditedAs: broadcastProgramContributor.creditedAs,
			})
			.from(broadcastProgramContributor)
			.innerJoin(broadcastProgram, eq(broadcastProgram.id, broadcastProgramContributor.programId))
			.where(and(this.visible(), eq(broadcastProgramContributor.entityId, entityId)))
			.orderBy(asc(broadcastProgram.name));
		const rows = await this.db
			.select({
				episode: broadcastEpisode,
				role: broadcastEpisodeContributor.role,
				creditedAs: broadcastEpisodeContributor.creditedAs,
				program: { id: broadcastProgram.id, name: broadcastProgram.name },
			})
			.from(broadcastEpisodeContributor)
			.innerJoin(broadcastEpisode, eq(broadcastEpisode.id, broadcastEpisodeContributor.episodeId))
			.innerJoin(broadcastProgram, eq(broadcastProgram.id, broadcastEpisode.programId))
			.where(and(this.visible(), eq(broadcastEpisodeContributor.entityId, entityId)))
			.orderBy(sql`${broadcastEpisode.releaseDate} desc nulls last`, asc(broadcastEpisode.name));
		const views = rows.length
			? await this.db
					.select()
					.from(broadcastView)
					.where(
						inArray(
							broadcastView.episodeId,
							rows.map(({ episode }) => episode.id),
						),
					)
					.orderBy(asc(broadcastView.date), asc(broadcastView.createdAt))
			: [];
		const episodes = rows.map(({ episode, ...credit }) => ({
			...toEpisodeDoc(episode, views.filter((view) => view.episodeId === episode.id).map(toViewDoc)),
			...credit,
		}));
		return { programs, episodes };
	}

	// Per entity and role: the ids of its programs, of its episodes. entityId: only this one.
	async findEntityCreditIds(entityId?: string) {
		const ids = (column: AnyColumn) => sql<string[]>`array_agg(distinct ${column})::text[]`;
		const [programs, episodes] = await Promise.all([
			this.db
				.select({
					entityId: broadcastProgramContributor.entityId,
					role: broadcastProgramContributor.role,
					ids: ids(broadcastProgramContributor.programId),
				})
				.from(broadcastProgramContributor)
				.innerJoin(broadcastProgram, eq(broadcastProgram.id, broadcastProgramContributor.programId))
				.where(and(this.visible(), entityId ? eq(broadcastProgramContributor.entityId, entityId) : undefined))
				.groupBy(broadcastProgramContributor.entityId, broadcastProgramContributor.role),
			this.db
				.select({
					entityId: broadcastEpisodeContributor.entityId,
					role: broadcastEpisodeContributor.role,
					ids: ids(broadcastEpisodeContributor.episodeId),
				})
				.from(broadcastEpisodeContributor)
				.innerJoin(broadcastEpisode, eq(broadcastEpisode.id, broadcastEpisodeContributor.episodeId))
				.innerJoin(broadcastProgram, eq(broadcastProgram.id, broadcastEpisode.programId))
				.where(and(this.visible(), entityId ? eq(broadcastEpisodeContributor.entityId, entityId) : undefined))
				.groupBy(broadcastEpisodeContributor.entityId, broadcastEpisodeContributor.role),
		]);
		return { programs, episodes };
	}

	// A merge: the program and episode credits of an entity go to another one
	async moveEntityCredits(tx: Tx, fromId: string, toId: string) {
		await moveCredits(tx, broadcastProgramContributor, "program_id", fromId, toId);
		await moveCredits(tx, broadcastEpisodeContributor, "episode_id", fromId, toId);
	}

	// The programs with a view in the period, each keeping only those views (and their episodes), the program
	// watched last first
	async findEpisodesInRange(period: Period = {}) {
		const programIds = await this.db
			.selectDistinct({ id: broadcastEpisode.programId })
			.from(broadcastView)
			.innerJoin(broadcastEpisode, eq(broadcastEpisode.id, broadcastView.episodeId))
			.where(inPeriod(period));
		if (!programIds.length) return [];
		const rows = await this.selectPrograms(
			inArray(
				broadcastProgram.id,
				programIds.map(({ id }) => id),
			),
		);
		const docs = await this.toDocs(
			rows,
			await this.loadEpisodes(
				rows.map(({ id }) => id),
				period,
			),
		);
		return docs.map(withoutDetails).toSorted((a, b) => {
			const [lastA, lastB] = [lastView(a), lastView(b)];
			return -compareValues(lastA?.date, lastB?.date) || -compareValues(lastA?.created, lastB?.created);
		});
	}

	// The programs of the most recent views across all the programs, each keeping only those views (oldest first,
	// like findEpisodesInRange), the program of the latest view first (home page)
	async findLatestEpisodes(limit: number) {
		const latest = await this.db
			.select({ episode: broadcastEpisode, view: broadcastView })
			.from(broadcastView)
			.innerJoin(broadcastEpisode, eq(broadcastEpisode.id, broadcastView.episodeId))
			.innerJoin(broadcastProgram, eq(broadcastProgram.id, broadcastEpisode.programId))
			.where(this.visible())
			.orderBy(desc(broadcastView.date), desc(broadcastView.createdAt))
			.limit(limit);
		const episodes = new Map<string, EpisodeDoc[]>();
		const byId = new Map<string, EpisodeDoc>();
		for (const { episode, view } of latest.toReversed()) {
			let doc = byId.get(episode.id);
			if (!doc) {
				doc = toEpisodeDoc(episode, []);
				byId.set(episode.id, doc);
				episodes.set(episode.programId, [...(episodes.get(episode.programId) ?? []), doc]);
			}
			doc.views.push(toViewDoc(view));
		}
		await this.loadEpisodeCredits([...byId.values()]);
		// the program of the latest view first
		const order = [...new Set(latest.map(({ episode }) => episode.programId))];
		if (!order.length) return [];
		const docs = await this.toDocs(await this.selectPrograms(inArray(broadcastProgram.id, order)), episodes);
		return docs.map(withoutDetails).toSorted((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
	}

	async findAllWithEpisodes() {
		const rows = await this.selectPrograms();
		const docs = await this.toDocs(rows, await this.loadEpisodes(rows.map(({ id }) => id)));
		return docs.map(({ id, name, shortName, tags, refs, episodes }) => ({
			id,
			name,
			shortName,
			tags,
			refs,
			episodes,
		}));
	}

	findById(id: string) {
		return this.findOne(eq(broadcastProgram.id, id));
	}

	findByRssUrl(rssUrl: string) {
		return this.findOne(eq(broadcastProgram.rss, rssUrl));
	}

	// undefined for an unknown episode of the program (or a private program, for a visitor)
	async findEpisode(programId: string, episodeId: string) {
		const program = await this.findById(programId);
		return program?.episodes.find(({ id }) => id === episodeId);
	}

	private async findChannels(where: SQL) {
		const docs = await this.toDocs(await this.selectPrograms(where));
		return docs.map(({ id, name, author, network }) => ({ id, name, author, network }));
	}

	findChannelsByYoutubeChannelId(channelId: string) {
		return this.findChannels(eq(broadcastProgram.youtubeChannelId, channelId));
	}

	findChannelsByUrl(url: string) {
		return this.findChannels(sql`${url} = any(${broadcastProgram.links})`);
	}

	async findProgramsWithYoutubeChannel() {
		return this.toDocs(
			await this.selectPrograms(
				and(
					isNotNull(broadcastProgram.youtubeChannelId),
					or(isNull(broadcastProgram.profileKey), isNull(broadcastProgram.bannerKey)),
				),
			),
		);
	}

	async findProgramsWithRssFeed() {
		return this.toDocs(
			await this.selectPrograms(
				and(
					isNotNull(broadcastProgram.rss),
					isNull(broadcastProgram.youtubeChannelId),
					isNull(broadcastProgram.profileKey),
				),
			),
		);
	}

	// The episode of the program holding this externalId (another than `exceptEpisodeId`), if any
	async findEpisodeIdByExternalId(programId: string, externalId: string, exceptEpisodeId?: string) {
		const [row] = await this.db
			.select({ id: broadcastEpisode.id })
			.from(broadcastEpisode)
			.where(
				and(
					eq(broadcastEpisode.programId, programId),
					eq(broadcastEpisode.externalId, externalId),
					exceptEpisodeId ? ne(broadcastEpisode.id, exceptEpisodeId) : undefined,
				),
			);
		return row?.id;
	}

	// The program with its credits and its optional first episode
	async insertProgram(
		program: ProgramFields,
		credits: SaveCredit<ProgramCreditRole>[] = [],
		episode?: EpisodeFields & { view: ViewFields | "planned" },
	) {
		await this.db.transaction(async (tx) => {
			await createNode(tx, { type: "program", label: program.name, id: program.id });
			await tx.insert(broadcastProgram).values({ ...programFields(program), id: program.id, name: program.name });
			await this.setCredits(tx, program.id, credits);
			if (episode) await this.addEpisode(tx, program.id, episode, episode.view);
		});
	}

	// The cover keys of the episodes deleted (back to feed), null for an unknown id. Credits left out are kept.
	async updateProgram(id: string, program: Partial<ProgramFields>, credits?: SaveCredit<ProgramCreditRole>[]) {
		return this.db.transaction(async (tx) => {
			const fields = programFields(program);
			const [row] = Object.keys(fields).length
				? await tx.update(broadcastProgram).set(fields).where(eq(broadcastProgram.id, id)).returning()
				: await tx.select().from(broadcastProgram).where(eq(broadcastProgram.id, id));
			if (!row) return null;
			if (fields.name) await renameNode(tx, id, fields.name);
			if (credits) await this.setCredits(tx, id, credits);
			// a feed only keeps the episodes viewed or with a status
			return fields.tracking === "feed" ? this.deleteUnused(tx, id) : [];
		});
	}

	findSeasons(programId: string) {
		return this.db
			.select({ id: broadcastSeason.id, position: broadcastSeason.position, label: broadcastSeason.label })
			.from(broadcastSeason)
			.where(eq(broadcastSeason.programId, programId))
			.orderBy(broadcastSeason.position);
	}

	findFormats(programId: string) {
		return this.db
			.select({
				id: broadcastFormat.id,
				position: broadcastFormat.position,
				label: broadcastFormat.label,
				match: broadcastFormat.match,
			})
			.from(broadcastFormat)
			.where(eq(broadcastFormat.programId, programId))
			.orderBy(broadcastFormat.position);
	}

	// The program's seasons become this ordered list: an item with an id is kept, one without created, one left out
	// deleted (its episodes lose it). Positions are unique: the kept ones move out of the way first.
	async replaceSeasons(programId: string, items: Array<{ id?: string; label: string }>) {
		await this.db.transaction(async (tx) => {
			const kept = items.flatMap(({ id }) => (id ? [id] : []));
			await tx
				.delete(broadcastSeason)
				.where(
					and(
						eq(broadcastSeason.programId, programId),
						kept.length ? notInArray(broadcastSeason.id, kept) : undefined,
					),
				);
			for (const [index, id] of kept.entries()) {
				await tx
					.update(broadcastSeason)
					.set({ position: -(index + 1) })
					.where(eq(broadcastSeason.id, id));
			}
			for (const [index, { id, label }] of items.entries()) {
				if (id) {
					await tx
						.update(broadcastSeason)
						.set({ label, position: index + 1 })
						.where(eq(broadcastSeason.id, id));
				} else {
					await tx.insert(broadcastSeason).values({ programId, label, position: index + 1 });
				}
			}
		});
		return this.findSeasons(programId);
	}

	// Same for the formats; their labels are unique: the kept ones take a temporary one first
	async replaceFormats(programId: string, items: Array<{ id?: string; label: string; match: string | null }>) {
		await this.db.transaction(async (tx) => {
			const kept = items.flatMap(({ id }) => (id ? [id] : []));
			await tx
				.delete(broadcastFormat)
				.where(
					and(
						eq(broadcastFormat.programId, programId),
						kept.length ? notInArray(broadcastFormat.id, kept) : undefined,
					),
				);
			for (const id of kept) {
				await tx
					.update(broadcastFormat)
					.set({ label: sql`${broadcastFormat.id}::text` })
					.where(eq(broadcastFormat.id, id));
			}
			for (const [index, { id, label, match }] of items.entries()) {
				if (id) {
					await tx
						.update(broadcastFormat)
						.set({ label, match, position: index + 1 })
						.where(eq(broadcastFormat.id, id));
				} else {
					await tx.insert(broadcastFormat).values({ programId, label, match, position: index + 1 });
				}
			}
		});
		return this.findFormats(programId);
	}

	// How many of these entities exist
	async countEntities(ids: string[]) {
		if (!ids.length) return 0;
		const [{ count }] = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(coreEntity)
			.where(inArray(coreEntity.id, ids));
		return count;
	}

	async setRssRef(programId: string, rssUrl: string) {
		await this.db.update(broadcastProgram).set({ rss: rssUrl }).where(eq(broadcastProgram.id, programId));
	}

	// The episode's id and the cover it replaced (an episode of the program with the same externalId gets the view),
	// undefined for an unknown program
	async createEpisode(programId: string, episode: EpisodeFields, view: ViewFields | "planned") {
		return this.db.transaction(async (tx) => {
			const [program] = await tx
				.select({ id: broadcastProgram.id })
				.from(broadcastProgram)
				.where(eq(broadcastProgram.id, programId));
			return program ? this.addEpisode(tx, programId, episode, view) : undefined;
		});
	}

	// false for an unknown episode of the program
	async updateEpisode(programId: string, episodeId: string, fields: EpisodeFields) {
		return this.db.transaction(async (tx) => {
			const [row] = await tx
				.update(broadcastEpisode)
				.set(episodeColumns(fields))
				.where(and(eq(broadcastEpisode.id, episodeId), eq(broadcastEpisode.programId, programId)))
				.returning({ id: broadcastEpisode.id });
			if (!row) return false;
			await renameNode(tx, episodeId, fields.name);
			await this.setEpisodeCredits(tx, episodeId, fields.credits ?? []);
			return true;
		});
	}

	// Through its node: its views go with it. Its cover key (null without), undefined for an unknown episode of the
	// program.
	async deleteEpisode(programId: string, episodeId: string) {
		return this.db.transaction(async (tx) => {
			const [episode] = await tx
				.select({ coverKey: broadcastEpisode.coverKey })
				.from(broadcastEpisode)
				.where(and(eq(broadcastEpisode.id, episodeId), eq(broadcastEpisode.programId, programId)));
			if (!episode) return undefined;
			await tx.delete(coreNode).where(eq(coreNode.id, episodeId));
			return episode.coverKey;
		});
	}

	// The cover key of the episode (of this program), undefined for an unknown episode (or a private program, for a
	// visitor)
	async findEpisodeCover(episodeId: string, programId?: string) {
		const [row] = await this.db
			.select({ coverKey: broadcastEpisode.coverKey })
			.from(broadcastEpisode)
			.innerJoin(broadcastProgram, eq(broadcastProgram.id, broadcastEpisode.programId))
			.where(
				and(
					eq(broadcastEpisode.id, episodeId),
					programId ? eq(broadcastEpisode.programId, programId) : undefined,
					this.visible(),
				),
			);
		return row;
	}

	async setEpisodeCovers(covers: Array<{ episodeId: string; coverKey: string }>) {
		await this.db.transaction(async (tx) => {
			for (const { episodeId, coverKey } of covers) {
				await tx.update(broadcastEpisode).set({ coverKey }).where(eq(broadcastEpisode.id, episodeId));
			}
		});
	}

	// the new view's id (the episode's status is cleared), undefined for an unknown episode of the program
	async createView(programId: string, episodeId: string, fields: ViewFields) {
		return this.db.transaction(async (tx) => {
			if (!(await this.isEpisodeOf(tx, programId, episodeId))) return undefined;
			await tx.update(broadcastEpisode).set({ status: null }).where(eq(broadcastEpisode.id, episodeId));
			const [view] = await tx
				.insert(broadcastView)
				.values({ ...viewColumns(fields), episodeId })
				.returning({ id: broadcastView.id });
			return view.id;
		});
	}

	// null clears it: a feed then deletes the episode left without any view. The cover keys of what was deleted,
	// null for an unknown episode of the program.
	async setEpisodeStatus(programId: string, episodeId: string, status: EpisodeStatus | null) {
		return this.db.transaction(async (tx) => {
			const [row] = await tx
				.update(broadcastEpisode)
				.set({ status })
				.where(and(eq(broadcastEpisode.id, episodeId), eq(broadcastEpisode.programId, programId)))
				.returning({ id: broadcastEpisode.id });
			if (!row) return null;
			if (status) return [];
			const [program] = await tx
				.select({ tracking: broadcastProgram.tracking })
				.from(broadcastProgram)
				.where(eq(broadcastProgram.id, programId));
			return program?.tracking === "feed" ? this.deleteUnused(tx, programId, episodeId) : [];
		});
	}

	// The planned episodes of the visible programs, with their views and credits
	async findWatchlist() {
		const rows = await this.db
			.select({ episode: broadcastEpisode, programName: broadcastProgram.name })
			.from(broadcastEpisode)
			.innerJoin(broadcastProgram, eq(broadcastProgram.id, broadcastEpisode.programId))
			.where(and(eq(broadcastEpisode.status, "planned"), this.visible()));
		const docs = rows.map(({ episode, programName }) => ({
			programId: episode.programId,
			programName,
			episode: toEpisodeDoc(episode, []),
		}));
		if (docs.length) {
			const byId = new Map(docs.map(({ episode }) => [episode.id, episode]));
			const views = await this.db
				.select()
				.from(broadcastView)
				.where(inArray(broadcastView.episodeId, [...byId.keys()]))
				.orderBy(asc(broadcastView.date), asc(broadcastView.createdAt));
			for (const view of views) byId.get(view.episodeId)?.views.push(toViewDoc(view));
			await this.loadEpisodeCredits([...byId.values()]);
		}
		return docs;
	}

	// false for an unknown view of the episode
	async updateView(programId: string, episodeId: string, viewId: string, fields: ViewFields) {
		if (!(await this.isEpisodeOf(this.db, programId, episodeId))) return false;
		const updated = await this.db
			.update(broadcastView)
			.set(viewColumns(fields))
			.where(and(eq(broadcastView.id, viewId), eq(broadcastView.episodeId, episodeId)))
			.returning({ id: broadcastView.id });
		return updated.length > 0;
	}

	// The episode goes too when it has no other view nor a status: the cover keys of what was deleted, null for an
	// unknown view of the episode.
	async deleteView(programId: string, episodeId: string, viewId: string) {
		return this.db.transaction(async (tx) => {
			if (!(await this.isEpisodeOf(tx, programId, episodeId))) return null;
			const deleted = await tx
				.delete(broadcastView)
				.where(and(eq(broadcastView.id, viewId), eq(broadcastView.episodeId, episodeId)))
				.returning({ id: broadcastView.id });
			if (!deleted.length) return null;
			// a catalog keeps its episodes
			const [program] = await tx
				.select({ tracking: broadcastProgram.tracking })
				.from(broadcastProgram)
				.where(eq(broadcastProgram.id, programId));
			return program?.tracking === "feed" ? this.deleteUnused(tx, programId, episodeId) : [];
		});
	}

	// Upsert by externalId of the source's releases into a catalog; a feed only gets its stored episodes completed
	// (nothing created, the program stays a feed). An episode gets the season
	// "Saison N" of its `itunes:season` (created when missing), its number and the format matching its title; a known
	// one only when it has none (a value set by hand stays), and its title, release date and duration (kept when the
	// source gives none), its description only when it has none; its views and status stay. A guid given twice by
	// the source counts once. The covers to download: of the episodes without one, when the source has one. null for
	// an unknown program.
	async importEpisodes(programId: string, items: CatalogEpisode[], type: string, formats: Format[]) {
		return this.db.transaction(async (tx) => {
			const [program] = await tx
				.select({ tracking: broadcastProgram.tracking })
				.from(broadcastProgram)
				.where(eq(broadcastProgram.id, programId));
			if (!program) return null;

			const rows = await tx
				.select({
					id: broadcastEpisode.id,
					externalId: broadcastEpisode.externalId,
					name: broadcastEpisode.name,
					releaseDate: broadcastEpisode.releaseDate,
					duration: broadcastEpisode.duration,
					seasonId: broadcastEpisode.seasonId,
					formatId: broadcastEpisode.formatId,
					position: broadcastEpisode.position,
					numberLabel: broadcastEpisode.numberLabel,
					description: broadcastEpisode.description,
					coverKey: broadcastEpisode.coverKey,
					link: broadcastEpisode.link,
				})
				.from(broadcastEpisode)
				.where(
					and(
						eq(broadcastEpisode.programId, programId),
						or(isNotNull(broadcastEpisode.externalId), isNotNull(broadcastEpisode.link)),
					),
				);
			const known = new Map(rows.flatMap((row) => (row.externalId ? [[row.externalId, row] as const] : [])));
			// an episode added by hand without externalId: found by the video of its YouTube link (and given its id)
			for (const row of rows) {
				const videoId = !row.externalId && row.link ? youtubeVideoId(row.link) : undefined;
				if (videoId && !known.has(videoId)) known.set(videoId, row);
			}
			// a feed: only its episodes (the seasons created are theirs)
			if (program.tracking === "feed") items = items.filter(({ externalId }) => known.has(externalId));
			const seen = new Set<string>();
			const seasonIds = await this.importSeasons(tx, programId, items);

			let updated = 0;
			const created: Array<typeof broadcastEpisode.$inferInsert & { id: string }> = [];
			const covers: CoverToImport[] = [];
			for (const item of items) {
				if (seen.has(item.externalId)) continue;
				seen.add(item.externalId);
				const episode = known.get(item.externalId);
				const seasonId = item.season ? (seasonIds.get(item.season) ?? null) : null;
				const formatId = matchFormat(formats, item.name)?.id ?? null;
				if (!episode) {
					const id = randomUUID();
					if (item.cover) covers.push({ episodeId: id, source: item.cover });
					created.push({
						id,
						programId,
						name: item.name,
						type,
						releaseDate: item.releaseDate ?? null,
						duration: item.duration || null,
						link: item.link ?? null,
						externalId: item.externalId,
						seasonId,
						formatId,
						position: item.position ?? null,
						numberLabel: item.numberLabel ?? null,
						description: item.description ?? null,
					});
					continue;
				}
				if (item.cover && !episode.coverKey) covers.push({ episodeId: episode.id, source: item.cover });
				const fields = {
					externalId: episode.externalId ?? item.externalId,
					name: item.name,
					releaseDate: item.releaseDate ?? episode.releaseDate,
					duration: item.duration || episode.duration,
					seasonId: episode.seasonId ?? seasonId,
					formatId: episode.formatId ?? formatId,
					position: episode.position ?? item.position ?? null,
					numberLabel: episode.numberLabel ?? item.numberLabel ?? null,
					description: episode.description ?? item.description ?? null,
				};
				if (Object.entries(fields).every(([key, value]) => episode[key as keyof typeof fields] === value)) {
					continue;
				}
				await tx.update(broadcastEpisode).set(fields).where(eq(broadcastEpisode.id, episode.id));
				if (fields.name !== episode.name) await renameNode(tx, episode.id, fields.name);
				updated++;
			}

			for (let start = 0; start < created.length; start += IMPORT_CHUNK) {
				const chunk = created.slice(start, start + IMPORT_CHUNK);
				await tx
					.insert(coreNode)
					.values(chunk.map(({ id, name }) => ({ id, type: "episode" as const, label: name })));
				await tx.insert(broadcastEpisode).values(chunk);
			}
			return { created: created.length, updated, covers };
		});
	}

	// The season of each `itunes:season` of the items: "Saison N" of the program, created after its last season
	// (in number order) when missing
	private async importSeasons(tx: Tx, programId: string, items: CatalogEpisode[]) {
		const seasons = await tx
			.select({ id: broadcastSeason.id, position: broadcastSeason.position, label: broadcastSeason.label })
			.from(broadcastSeason)
			.where(eq(broadcastSeason.programId, programId));
		const byLabel = new Map(seasons.map(({ id, label }) => [label, id]));
		let position = Math.max(0, ...seasons.map(({ position }) => position));
		const ids = new Map<number, string>();
		const numbers = [...new Set(items.flatMap(({ season }) => (season ? [season] : [])))].toSorted((a, b) => a - b);
		for (const season of numbers) {
			let id = byLabel.get(seasonLabel(season));
			if (!id) {
				position++;
				[{ id }] = await tx
					.insert(broadcastSeason)
					.values({ programId, label: seasonLabel(season), position })
					.returning({ id: broadcastSeason.id });
			}
			ids.set(season, id);
		}
		return ids;
	}

	// Same filtering as findEpisodesInRange
	findStatsRaw(period: Period = {}) {
		return this.findEpisodesInRange(period);
	}

	private async isEpisodeOf(db: Tx | Drizzle, programId: string, episodeId: string) {
		const [row] = await db
			.select({ id: broadcastEpisode.id })
			.from(broadcastEpisode)
			.where(and(eq(broadcastEpisode.id, episodeId), eq(broadcastEpisode.programId, programId)));
		return Boolean(row);
	}

	// A new view (its status cleared) or the status planned of the program's episode with the same externalId
	// (relistening: its fields are updated), else a new episode. Answers the episode's id, and the cover key it
	// replaced.
	private async addEpisode(tx: Tx, programId: string, episode: EpisodeFields, view: ViewFields | "planned") {
		const status = view === "planned" ? view : null;
		const [existing] = episode.externalId
			? await tx
					.select({ id: broadcastEpisode.id, coverKey: broadcastEpisode.coverKey })
					.from(broadcastEpisode)
					.where(
						and(
							eq(broadcastEpisode.programId, programId),
							eq(broadcastEpisode.externalId, episode.externalId),
						),
					)
			: [];
		let episodeId = existing?.id;
		if (episodeId) {
			// an imported episode keeps its release date, season, number… unless they are given
			await tx
				.update(broadcastEpisode)
				.set({ ...givenEpisodeColumns(episode), status })
				.where(eq(broadcastEpisode.id, episodeId));
			await renameNode(tx, episodeId, episode.name);
			// a relistening keeps the episode's credits unless it gives some
			if (episode.credits?.length) await this.setEpisodeCredits(tx, episodeId, episode.credits);
		} else {
			episodeId = await createNode(tx, { type: "episode", label: episode.name });
			await tx.insert(broadcastEpisode).values({ ...episodeColumns(episode), id: episodeId, programId, status });
			await this.setEpisodeCredits(tx, episodeId, episode.credits ?? []);
		}
		if (view !== "planned") await tx.insert(broadcastView).values({ ...viewColumns(view), episodeId });
		const replaced = episode.coverKey !== undefined && existing?.coverKey !== episode.coverKey;
		return { episodeId, replacedCoverKey: replaced ? (existing?.coverKey ?? null) : null };
	}

	// The episodes of the program (or this one only) without any view nor status go, through their nodes: answers
	// their cover keys
	private async deleteUnused(tx: Tx, programId: string, episodeId?: string) {
		const unused = await tx
			.select({ id: broadcastEpisode.id, coverKey: broadcastEpisode.coverKey })
			.from(broadcastEpisode)
			.where(
				and(
					eq(broadcastEpisode.programId, programId),
					episodeId ? eq(broadcastEpisode.id, episodeId) : undefined,
					isNull(broadcastEpisode.status),
					sql`not exists (select 1 from ${broadcastView} where ${broadcastView.episodeId} = ${broadcastEpisode.id})`,
				),
			);
		if (unused.length) {
			await tx.delete(coreNode).where(
				inArray(
					coreNode.id,
					unused.map(({ id }) => id),
				),
			);
		}
		return unused.flatMap(({ coverKey }) => (coverKey ? [coverKey] : []));
	}

	// Replaces every credit of the program; `order` = the position among the credits of the same role
	private async setCredits(tx: Tx, programId: string, credits: SaveCredit<ProgramCreditRole>[]) {
		await tx.delete(broadcastProgramContributor).where(eq(broadcastProgramContributor.programId, programId));
		const rows = withOrder(credits).map((credit) => ({ ...credit, programId }));
		if (rows.length) await tx.insert(broadcastProgramContributor).values(rows).onConflictDoNothing();
	}

	private async setEpisodeCredits(tx: Tx, episodeId: string, credits: SaveCredit<EpisodeCreditRole>[]) {
		await tx.delete(broadcastEpisodeContributor).where(eq(broadcastEpisodeContributor.episodeId, episodeId));
		const rows = withOrder(credits).map((credit) => ({ ...credit, episodeId }));
		if (rows.length) await tx.insert(broadcastEpisodeContributor).values(rows).onConflictDoNothing();
	}
}
