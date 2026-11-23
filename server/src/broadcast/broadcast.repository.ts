import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { Drizzle } from "../database/drizzle.js";
import type { EpisodeDoc, ProgramDoc } from "./broadcast.entity.js";

import { viewerIsOwner } from "../common/request-context.js";
import { contains } from "../database/contains.query.js";
import { DRIZZLE } from "../database/database.tokens.js";
import { createEntity, createNode, renameNode, type Tx } from "../database/node.query.js";
import {
	broadcastEpisode,
	broadcastProgram,
	broadcastProgramContributor,
	broadcastView,
	coreEntity,
	coreNode,
} from "../database/schema.js";

// Not sent by the episode form when empty (see onSubmitEpisode and cleanEpisode): left out = cleared
const CLEARABLE_EPISODE_FIELDS = ["durationReal", "tags", "contextTags", "ignoredTags"] as const;
// Between the names of `author` / `network`
const PROGRAM_SEPARATOR = "&";

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
type ViewWithEpisode = {
	view: typeof broadcastView.$inferSelect;
	episode: typeof broadcastEpisode.$inferSelect;
};
type Credits = { author?: string; network?: string };

// What the list answers on top of the program
type ProgramSummary = Omit<ProgramDoc, "episodes"> & {
	episodeCount: number;
	totalDuration: number;
	latestEpisodeDate: string | null;
	latestEpisodeCreated: string | null;
};

// Mongo answered absent fields, not nulls: optional values are left out when empty
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

function toEpisodeDoc({ view, episode }: ViewWithEpisode): EpisodeDoc {
	return {
		id: view.id,
		name: episode.name,
		shortName: present(episode.shortName),
		duration: episode.duration ?? 0,
		durationReal: present(view.duration),
		date: view.date,
		type: episode.type ?? "",
		link: present(episode.link),
		tags: present(episode.tags),
		contextTags: present(view.contextTags),
		ignoredTags: present(episode.ignoredTags),
		created: view.createdAt,
		comment: present(view.comment),
		externalId: present(episode.externalId),
	};
}

// The fields of an API episode that belong to its episode (the release) / to its view (the listening)
function episodeFields(doc: Partial<EpisodeDoc>) {
	const fields: Partial<typeof broadcastEpisode.$inferInsert> = {};
	if (doc.name !== undefined) fields.name = doc.name;
	if (doc.shortName !== undefined) fields.shortName = doc.shortName || null;
	if (doc.duration !== undefined) fields.duration = doc.duration || null;
	if (doc.type !== undefined) fields.type = doc.type || null;
	if (doc.link !== undefined) fields.link = doc.link || null;
	if (doc.externalId !== undefined) fields.externalId = doc.externalId || null;
	if (doc.tags !== undefined) fields.tags = doc.tags;
	if (doc.ignoredTags !== undefined) fields.ignoredTags = doc.ignoredTags;
	return fields;
}
function viewFields(doc: Partial<EpisodeDoc>) {
	const fields: Partial<typeof broadcastView.$inferInsert> = {};
	if (doc.date !== undefined) fields.date = doc.date;
	if (doc.durationReal !== undefined) fields.duration = doc.durationReal;
	if (doc.contextTags !== undefined) fields.contextTags = doc.contextTags;
	if (doc.comment !== undefined) fields.comment = doc.comment || null;
	if (doc.created !== undefined) fields.createdAt = doc.created;
	return fields;
}

// The program's own columns among the fields of a program document ($set semantics: left out = unchanged)
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

// Absent values sort first ascending, as Mongo sorts them
function compareValues(a: unknown, b: unknown) {
	if (a === b) return 0;
	if (a === null || a === undefined) return -1;
	if (b === null || b === undefined) return 1;
	if (typeof a === "number" && typeof b === "number") return a - b;
	return collator.compare(String(a), String(b));
}

const splitNames = (value: string | undefined) =>
	(value ?? "")
		.split(PROGRAM_SEPARATOR)
		.map((name) => name.trim())
		.filter(Boolean);

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

	// author = the host and producer credits, network = the network ones, in credit order
	private async loadCredits(programIds: string[]) {
		const credits = new Map<string, Credits>();
		if (!programIds.length) return credits;
		const rows = await this.db
			.select({
				programId: broadcastProgramContributor.programId,
				role: broadcastProgramContributor.role,
				name: coreEntity.name,
			})
			.from(broadcastProgramContributor)
			.innerJoin(coreEntity, eq(coreEntity.id, broadcastProgramContributor.entityId))
			.where(inArray(broadcastProgramContributor.programId, programIds))
			.orderBy(
				broadcastProgramContributor.programId,
				broadcastProgramContributor.role,
				broadcastProgramContributor.order,
			);
		const names = new Map<string, { author: string[]; network: string[] }>();
		for (const { programId, role, name } of rows) {
			const entry = names.get(programId) ?? { author: [], network: [] };
			entry[role === "network" ? "network" : "author"].push(name);
			names.set(programId, entry);
		}
		for (const [programId, { author, network }] of names) {
			credits.set(programId, {
				author: author.length ? author.join(` ${PROGRAM_SEPARATOR} `) : undefined,
				network: network.length ? network.join(` ${PROGRAM_SEPARATOR} `) : undefined,
			});
		}
		return credits;
	}

	// The views (with their episode) of these programs, in the period, oldest first
	private async loadEpisodes(programIds: string[], { from, to }: Period = {}) {
		const episodes = new Map<string, EpisodeDoc[]>();
		if (!programIds.length) return episodes;
		const rows = await this.db
			.select({ view: broadcastView, episode: broadcastEpisode })
			.from(broadcastView)
			.innerJoin(broadcastEpisode, eq(broadcastEpisode.id, broadcastView.episodeId))
			.where(
				and(
					inArray(broadcastEpisode.programId, programIds),
					from ? gte(broadcastView.date, from) : undefined,
					to ? lte(broadcastView.date, to) : undefined,
				),
			)
			.orderBy(asc(broadcastView.date), asc(broadcastView.createdAt));
		for (const row of rows) {
			episodes.set(row.episode.programId, [...(episodes.get(row.episode.programId) ?? []), toEpisodeDoc(row)]);
		}
		return episodes;
	}

	private async toDocs(rows: ProgramRow[], episodes?: Map<string, EpisodeDoc[]>) {
		const credits = await this.loadCredits(rows.map(({ id }) => id));
		return rows.map((row) => toProgramDoc(row, credits.get(row.id) ?? {}, episodes?.get(row.id) ?? []));
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
			.where(contains(coreEntity.name, search));
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

	// The programs with an episode in the period, each keeping only those episodes, the latest listened first
	async findEpisodesInRange(period: Period = {}) {
		const programIds = await this.db
			.selectDistinct({ id: broadcastEpisode.programId })
			.from(broadcastView)
			.innerJoin(broadcastEpisode, eq(broadcastEpisode.id, broadcastView.episodeId))
			.where(
				and(
					period.from ? gte(broadcastView.date, period.from) : undefined,
					period.to ? lte(broadcastView.date, period.to) : undefined,
				),
			);
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
		return docs
			.map(({ refs: _refs, links: _links, description: _description, ...doc }) => doc)
			.toSorted((a, b) => {
				const [lastA, lastB] = [a.episodes.at(-1), b.episodes.at(-1)];
				return -compareValues(lastA?.date, lastB?.date) || -compareValues(lastA?.created, lastB?.created);
			});
	}

	// The programs of the most recent episodes across all the programs, each keeping only those episodes
	// (oldest first, like findEpisodesInRange), the program of the latest episode first (home page)
	async findLatestEpisodes(limit: number) {
		const latest = await this.db
			.select({ view: broadcastView, episode: broadcastEpisode })
			.from(broadcastView)
			.innerJoin(broadcastEpisode, eq(broadcastEpisode.id, broadcastView.episodeId))
			.innerJoin(broadcastProgram, eq(broadcastProgram.id, broadcastEpisode.programId))
			.where(this.visible())
			.orderBy(desc(broadcastView.date), desc(broadcastView.createdAt))
			.limit(limit);
		const episodes = new Map<string, EpisodeDoc[]>();
		for (const row of latest) {
			episodes.set(row.episode.programId, [toEpisodeDoc(row), ...(episodes.get(row.episode.programId) ?? [])]);
		}
		const order = [...episodes.keys()];
		const rows = await this.selectPrograms(inArray(broadcastProgram.id, order.length ? order : [randomUUID()]));
		const docs = await this.toDocs(rows, episodes);
		return docs
			.map(({ refs: _refs, links: _links, description: _description, ...doc }) => doc)
			.toSorted((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
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

	async insertProgram(program: ProgramDoc) {
		await this.db.transaction(async (tx) => {
			await createNode(tx, { type: "program", label: program.name, id: program.id });
			await tx.insert(broadcastProgram).values({ id: program.id, name: program.name, ...programFields(program) });
			await this.setCredits(tx, program.id, program);
			for (const episode of program.episodes) {
				await this.addEpisode(tx, program.id, episode);
			}
		});
		return program;
	}

	// the updated program, null for an unknown id
	async updateProgram(id: string, program: Partial<ProgramDoc>) {
		const updated = await this.db.transaction(async (tx) => {
			const fields = programFields(program);
			const [row] = Object.keys(fields).length
				? await tx.update(broadcastProgram).set(fields).where(eq(broadcastProgram.id, id)).returning()
				: await tx.select().from(broadcastProgram).where(eq(broadcastProgram.id, id));
			if (!row) return false;
			if (fields.name) await renameNode(tx, id, fields.name);
			await this.setCredits(tx, id, program);
			return true;
		});
		return updated ? this.findById(id) : null;
	}

	async setRssRef(programId: string, rssUrl: string) {
		await this.db.update(broadcastProgram).set({ rss: rssUrl }).where(eq(broadcastProgram.id, programId));
	}

	// false for an unknown program
	async pushEpisode(programId: string, episode: EpisodeDoc) {
		return this.db.transaction(async (tx) => {
			const [program] = await tx
				.select({ id: broadcastProgram.id })
				.from(broadcastProgram)
				.where(eq(broadcastProgram.id, programId));
			if (!program) return false;
			await this.addEpisode(tx, programId, episode);
			return true;
		});
	}

	// false for an unknown program or episode. Fields left out are kept, apart from the clearable ones.
	async updateEpisode(programId: string, episode: Partial<EpisodeDoc> & { id: string }) {
		return this.db.transaction(async (tx) => {
			const current = await this.findView(tx, programId, episode.id);
			if (!current) return false;
			const cleared = Object.fromEntries(
				CLEARABLE_EPISODE_FIELDS.filter((key) => !(key in episode)).map((key) => [
					key,
					key === "durationReal" ? null : [],
				]),
			) as Partial<EpisodeDoc>;
			const doc = { ...cleared, ...episode };

			// the externalId of another episode of the program: this listening is of that release
			const target = doc.externalId
				? await this.findEpisodeByExternalId(tx, programId, doc.externalId)
				: undefined;
			const episodeId = target && target !== current.episodeId ? target : current.episodeId;
			const fields = episodeFields(doc);
			await tx.update(broadcastEpisode).set(fields).where(eq(broadcastEpisode.id, episodeId));
			if (fields.name) await renameNode(tx, episodeId, fields.name);
			await tx
				.update(broadcastView)
				.set({ ...viewFields(doc), episodeId })
				.where(eq(broadcastView.id, episode.id));
			if (episodeId !== current.episodeId) await this.deleteIfUnused(tx, current.episodeId);
			return true;
		});
	}

	// false for an unknown program or episode
	async deleteEpisode(programId: string, viewId: string) {
		return this.db.transaction(async (tx) => {
			const current = await this.findView(tx, programId, viewId);
			if (!current) return false;
			await tx.delete(broadcastView).where(eq(broadcastView.id, viewId));
			await this.deleteIfUnused(tx, current.episodeId);
			return true;
		});
	}

	// Same filtering as findEpisodesInRange
	findStatsRaw(period: Period = {}) {
		return this.findEpisodesInRange(period);
	}

	private async findView(tx: Tx, programId: string, viewId: string) {
		const [row] = await tx
			.select({ episodeId: broadcastView.episodeId })
			.from(broadcastView)
			.innerJoin(broadcastEpisode, eq(broadcastEpisode.id, broadcastView.episodeId))
			.where(and(eq(broadcastView.id, viewId), eq(broadcastEpisode.programId, programId)));
		return row;
	}

	private async findEpisodeByExternalId(tx: Tx, programId: string, externalId: string) {
		const [row] = await tx
			.select({ id: broadcastEpisode.id })
			.from(broadcastEpisode)
			.where(and(eq(broadcastEpisode.programId, programId), eq(broadcastEpisode.externalId, externalId)));
		return row?.id;
	}

	// A listening: a new view of the program's episode with the same externalId (relistening, its fields updated),
	// else a new episode. A new episode takes the view's id.
	private async addEpisode(tx: Tx, programId: string, episode: EpisodeDoc) {
		const existing = episode.externalId
			? await this.findEpisodeByExternalId(tx, programId, episode.externalId)
			: undefined;
		let episodeId = existing;
		if (existing) {
			await tx.update(broadcastEpisode).set(episodeFields(episode)).where(eq(broadcastEpisode.id, existing));
			await renameNode(tx, existing, episode.name);
		} else {
			episodeId = await createNode(tx, { type: "episode", label: episode.name, id: episode.id });
			await tx
				.insert(broadcastEpisode)
				.values({ ...episodeFields(episode), id: episodeId, programId, name: episode.name });
		}
		await tx
			.insert(broadcastView)
			.values({ ...viewFields(episode), id: episode.id, episodeId: episodeId!, date: episode.date });
	}

	// An episode without any view nor status goes, through its node
	private async deleteIfUnused(tx: Tx, episodeId: string) {
		await tx
			.delete(coreNode)
			.where(
				and(
					eq(coreNode.id, episodeId),
					sql`not exists (select 1 from ${broadcastView} where ${broadcastView.episodeId} = ${episodeId})`,
					sql`not exists (select 1 from ${broadcastEpisode} where ${broadcastEpisode.id} = ${episodeId} and ${broadcastEpisode.status} is not null)`,
				),
			);
	}

	// Replaces the author / network credits given (a field left out keeps its credits)
	private async setCredits(tx: Tx, programId: string, { author, network }: Partial<ProgramDoc>) {
		if (author !== undefined) {
			await tx
				.delete(broadcastProgramContributor)
				.where(
					and(
						eq(broadcastProgramContributor.programId, programId),
						inArray(broadcastProgramContributor.role, ["host", "producer"]),
					),
				);
			const order = { host: 0, producer: 0 };
			for (const name of splitNames(author)) {
				const entity = await this.findOrCreateEntity(tx, name, "person");
				const role = entity.kind === "organization" ? "producer" : "host";
				await tx
					.insert(broadcastProgramContributor)
					.values({ programId, entityId: entity.id, role, order: order[role]++ })
					.onConflictDoNothing();
			}
		}
		if (network !== undefined) {
			await tx
				.delete(broadcastProgramContributor)
				.where(
					and(
						eq(broadcastProgramContributor.programId, programId),
						eq(broadcastProgramContributor.role, "network"),
					),
				);
			let order = 0;
			for (const name of splitNames(network)) {
				const entity = await this.findOrCreateEntity(tx, name, "organization", true);
				await tx
					.insert(broadcastProgramContributor)
					.values({ programId, entityId: entity.id, role: "network", order: order++ })
					.onConflictDoNothing();
			}
		}
	}

	// An entity with this name (case and accents ignored), of this kind only when `sameKind`, else a new one
	private async findOrCreateEntity(tx: Tx, name: string, kind: "person" | "organization", sameKind = false) {
		const [existing] = await tx
			.select({ id: coreEntity.id, kind: coreEntity.kind })
			.from(coreEntity)
			.where(
				and(
					sql`unaccent(lower(${coreEntity.name})) = unaccent(lower(${name}))`,
					sameKind ? eq(coreEntity.kind, kind) : undefined,
				),
			)
			.orderBy(sql`${coreEntity.kind} = ${kind} desc`)
			.limit(1);
		return existing ?? (await createEntity(tx, { kind, name }));
	}
}
