import type { ReadingModelItem } from "@personal-tracker/shared/reading-book";
import type { SpectacleLink } from "@personal-tracker/shared/show";

import { sql } from "drizzle-orm";
import {
	snakeCase,
	integer,
	varchar,
	date,
	numeric,
	time,
	text,
	timestamp,
	primaryKey,
	uniqueIndex,
	index,
	boolean,
	foreignKey,
	uuid,
	jsonb,
	type AnyPgColumn,
	customType,
	unique,
	check,
} from "drizzle-orm/pg-core";

// timestamp read as an ISO local date-time ("2024-01-01T20:00:00"):
// postgres prints a space instead of the T, which z.iso.datetime({ local: true }) rejects
const localTimestamp = customType<{ data: string; driverData: string }>({
	dataType: () => "timestamp",
	fromDriver: (value) => value.replace(" ", "T"),
});

export const money = snakeCase.schema("money");
export const show = snakeCase.schema("show");
export const auth = snakeCase.schema("auth");
export const core = snakeCase.schema("core");

export const moneyAccount = money.table(
	"account",
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		name: varchar({ length: 255 }),
		icon: varchar({ length: 255 }),
		textColor: varchar({ length: 255 }),
		backgroundColor: varchar({ length: 255 }),
		bankId: integer().references(() => moneyBank.id, { onDelete: "cascade", onUpdate: "cascade" }),
	},
	(table) => [index().on(table.bankId)],
);

export const moneyAccountHistory = money.table(
	"account_history",
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		accountId: integer()
			.notNull()
			.references(() => moneyAccount.id, { onDelete: "cascade", onUpdate: "cascade" }),
		date: date({ mode: "string" }),
		amount: numeric({ precision: 10, scale: 2, mode: "number" }),
	},
	(table) => [index().on(table.accountId)],
);

export const moneyBank = money.table("bank", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	name: varchar({ length: 255 }),
});

export const moneyPaymentType = money.table(
	"payment_type",
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		name: varchar({ length: 255 }),
		icon: varchar({ length: 255 }),
		textColor: varchar({ length: 255 }),
		backgroundColor: varchar({ length: 255 }),
		accountId: integer().references(() => moneyAccount.id, {
			onDelete: "cascade",
			onUpdate: "cascade",
		}),
	},
	(table) => [index().on(table.accountId)],
);

export const showModel = show.table("model", {
	id: uuid().primaryKey().defaultRandom(),
	name: varchar({ length: 100 }).notNull(),
	spectacleId: uuid()
		.notNull()
		.references(() => showSpectacle.id),
});

export const showModelRole = show.table(
	"model_role",
	{
		id: uuid().primaryKey().defaultRandom(),
		name: varchar({ length: 100 }),
		main: boolean(),
		// the artist: a person entity (none yet: a role still to cast)
		entityId: uuid().references(() => coreEntity.id),
		modelId: uuid().references(() => showModel.id),
		order: integer(),
	},
	(table) => [index().on(table.entityId), index().on(table.modelId)],
);

export const showCastingStatus = show.enum("casting_status", ["tbd", "unknown", "partial", "complete"]);
export const showCastingOrigin = show.enum("casting_origin", ["na", "program", "performance"]);

export const showPerformance = show.table(
	"performance",
	{
		id: uuid().primaryKey().defaultRandom(),
		date: localTimestamp().notNull(),
		placeId: uuid().references(() => showPlace.id),
		spectacleId: uuid()
			.notNull()
			.references(() => showSpectacle.id),
		canceled: boolean().default(false).notNull(),
		seat: varchar({ length: 45 }).default("").notNull(),
		casting_status: showCastingStatus().default("tbd").notNull(),
		casting_origin: showCastingOrigin().default("na").notNull(),
		posterId: uuid(),
	},
	(table) => [
		index().on(table.placeId),
		index().on(table.spectacleId),
		foreignKey({
			name: "performance_poster_fkey",
			columns: [table.spectacleId, table.posterId],
			foreignColumns: [showSpectacleMedia.spectacleId, showSpectacleMedia.mediaId],
		}),
	],
);

export const showPlace = show.table("place", {
	id: uuid()
		.primaryKey()
		.references(() => coreNode.id, { onDelete: "cascade" }),
	name: varchar({ length: 100 }).notNull(),
	address: text().notNull(),
	country: varchar({ length: 2 }).notNull(),
	link: varchar({ length: 100 }),
});

export const showPlaceFormerName = show.table(
	"place_former_name",
	{
		id: uuid().primaryKey().defaultRandom(),
		placeId: uuid()
			.notNull()
			.references(() => showPlace.id, { onDelete: "cascade" }),
		name: varchar({ length: 100 }).notNull(),
		untilDate: date({ mode: "string" }).notNull(),
	},
	(table) => [uniqueIndex().on(table.placeId, table.untilDate)],
);

export const showRole = show.table(
	"role",
	{
		id: uuid().primaryKey().defaultRandom(),
		// the artist: a person entity
		entityId: uuid().references(() => coreEntity.id),
		performanceId: uuid().references(() => showPerformance.id),
		name: varchar({ length: 100 }),
		status: varchar({ length: 45 }),
		main: boolean().default(false),
		order: integer(),
	},
	(table) => [index().on(table.entityId)],
);

export const showSpectacle = show.table(
	"spectacle",
	{
		id: uuid()
			.primaryKey()
			.references(() => coreNode.id, { onDelete: "cascade" }),
		name: varchar({ length: 100 }).notNull(),
		workId: uuid()
			.notNull()
			.references(() => showWork.id),
		description: text(),
		descriptionSource: text(),
		links: jsonb().$type<SpectacleLink[]>().default([]).notNull(),
		// markdown
		tracklist: text(),
	},
	(table) => [index().on(table.workId)],
);

export const showWork = show.table("work", {
	id: uuid()
		.primaryKey()
		.references(() => coreNode.id, { onDelete: "cascade" }),
	name: varchar({ length: 100 }).notNull(),
});

// Facts about the file only; owners are attached through the *_media link tables
export const showMedia = show.table("media", {
	id: uuid().primaryKey().defaultRandom(),
	key: varchar({ length: 200 }).notNull(),
	label: varchar({ length: 100 }).default("").notNull(),
	contentType: varchar({ length: 100 }).notNull(),
	// position in its owner's gallery, then upload time (uuids don't sort)
	order: integer().default(0).notNull(),
	createdAt: timestamp().defaultNow().notNull(),
});

export const showSpectacleMediaKind = show.enum("spectacle_media_kind", ["poster", "photo", "programme", "recording"]);

export const showSpectacleMedia = show.table(
	"spectacle_media",
	{
		spectacleId: uuid()
			.notNull()
			.references(() => showSpectacle.id, { onDelete: "cascade" }),
		mediaId: uuid()
			.notNull()
			.references(() => showMedia.id, { onDelete: "cascade" }),
		kind: showSpectacleMediaKind().default("poster").notNull(),
	},
	(table) => [primaryKey({ columns: [table.spectacleId, table.mediaId] }), index().on(table.mediaId)],
);

export const moneyTransactionTag = money.table(
	"transaction_tag",
	{
		transactionId: integer()
			.notNull()
			.references(() => moneyTransaction.id, { onDelete: "cascade" }),
		tagId: integer()
			.notNull()
			.references(() => moneyTag.id, { onDelete: "cascade", onUpdate: "restrict" }),
	},
	(table) => [primaryKey({ columns: [table.transactionId, table.tagId] }), index().on(table.tagId)],
);

export const moneyCategory = money.table(
	"category",
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		name: varchar({ length: 255 }),
		icon: varchar({ length: 255 }),
		textColor: varchar({ length: 255 }),
		backgroundColor: varchar({ length: 255 }),
		parentId: integer(),
	},
	(table) => [index().on(table.parentId), uniqueIndex().on(table.name)],
);

export const moneyTransaction = money.table(
	"transaction",
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		name: varchar({ length: 255 }),
		description: varchar({ length: 255 }),
		date: date({ mode: "string" }),
		time: time(),
		considerationDate: date({ mode: "string" }),
		amount: numeric({ precision: 10, scale: 2, mode: "number" }),
		comment: text(),
		parentId: integer(),
		recurrent: boolean(),
		informative: boolean(),
		categoryId: integer().references(() => moneyCategory.id, {
			onDelete: "set null",
			onUpdate: "cascade",
		}),
		paymentTypeId: integer().references(() => moneyPaymentType.id, {
			onDelete: "set null",
			onUpdate: "cascade",
		}),
	},
	(table) => [index().on(table.paymentTypeId), index().on(table.categoryId), index().on(table.parentId)],
);

export const moneyTag = money.table(
	"tag",
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		name: varchar({ length: 255 }),
		icon: varchar({ length: 255 }),
		textColor: varchar({ length: 255 }),
		backgroundColor: varchar({ length: 255 }),
		parentId: integer(),
	},
	(table) => [index().on(table.parentId), uniqueIndex().on(table.name)],
);

// BetterAuth core tables (fields from better-auth's getAuthTables, passed to its drizzle adapter in src/auth.ts)
export const authUser = auth.table("user", {
	id: text().primaryKey(),
	name: text().notNull(),
	email: text().notNull().unique(),
	emailVerified: boolean().default(false).notNull(),
	image: text(),
	createdAt: timestamp().defaultNow().notNull(),
	updatedAt: timestamp().defaultNow().notNull(),
});

export const authSession = auth.table(
	"session",
	{
		id: text().primaryKey(),
		expiresAt: timestamp().notNull(),
		token: text().notNull().unique(),
		createdAt: timestamp().defaultNow().notNull(),
		updatedAt: timestamp().defaultNow().notNull(),
		ipAddress: text(),
		userAgent: text(),
		userId: text()
			.notNull()
			.references(() => authUser.id, { onDelete: "cascade" }),
	},
	(table) => [index().on(table.userId)],
);

export const authAccount = auth.table(
	"account",
	{
		id: text().primaryKey(),
		accountId: text().notNull(),
		providerId: text().notNull(),
		userId: text()
			.notNull()
			.references(() => authUser.id, { onDelete: "cascade" }),
		accessToken: text(),
		refreshToken: text(),
		idToken: text(),
		accessTokenExpiresAt: timestamp(),
		refreshTokenExpiresAt: timestamp(),
		scope: text(),
		password: text(),
		createdAt: timestamp().defaultNow().notNull(),
		updatedAt: timestamp().defaultNow().notNull(),
	},
	(table) => [index().on(table.userId)],
);

export const authVerification = auth.table(
	"verification",
	{
		id: text().primaryKey(),
		identifier: text().notNull(),
		value: text().notNull(),
		expiresAt: timestamp().notNull(),
		createdAt: timestamp().defaultNow().notNull(),
		updatedAt: timestamp().defaultNow().notNull(),
	},
	(table) => [index().on(table.identifier)],
);

// Registry of everything that can be linked across modules: each linkable row shares its node's uuid.
// See .scratch/connected-domains/spec.md
export const coreNodeType = core.enum("node_type", [
	"entity",
	"book",
	"book_series",
	"book_edition",
	"program",
	"episode",
	"show_work",
	"show_spectacle",
	"show_place",
]);

export const coreNode = core.table("node", {
	id: uuid().primaryKey().defaultRandom(),
	type: coreNodeType().notNull(),
	// display name, kept in sync with the row it stands for (search, link lists)
	label: text().notNull(),
});

export const coreExternalSource = core.enum("external_source", ["openLibrary"]);

// A node's id in an outside source (Open Library…): one per source, and an outside id names a single node
export const coreExternalId = core.table(
	"external_id",
	{
		nodeId: uuid()
			.notNull()
			.references(() => coreNode.id, { onDelete: "cascade" }),
		source: coreExternalSource().notNull(),
		externalId: text().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.nodeId, table.source] }),
		unique("external_id_source_external_id_key").on(table.source, table.externalId),
	],
);

export const coreEntityKind = core.enum("entity_kind", ["person", "group", "organization"]);

// People, groups and organizations (supertype). The kind-specific fields live in the core.entity_<kind> tables.
export const coreEntity = core.table(
	"entity",
	{
		id: uuid()
			.primaryKey()
			.references(() => coreNode.id, { onDelete: "cascade" }),
		kind: coreEntityKind().notNull(),
		name: text().notNull(),
		// "Carroll, Lewis"
		sortName: text(),
		pictureKey: text(),
	},
	// (id, kind) is the target of the subtype FKs: a subtype row can only belong to an entity of its kind
	(table) => [unique("entity_id_kind_key").on(table.id, table.kind), index().on(table.kind)],
);

function entitySubtypeConstraints(name: string, kind: "person" | "group" | "organization") {
	return (table: { id: AnyPgColumn; kind: AnyPgColumn }) => [
		foreignKey({
			name: `${name}_entity_fkey`,
			columns: [table.id, table.kind],
			foreignColumns: [coreEntity.id, coreEntity.kind],
		}).onDelete("cascade"),
		check(`${name}_kind_check`, sql`${table.kind} = ${sql.raw(`'${kind}'`)}`),
	];
}

export const coreEntityPerson = core.table(
	"entity_person",
	{
		id: uuid().primaryKey(),
		kind: coreEntityKind().default("person").notNull(),
		birthDate: date(),
		deathDate: date(),
	},
	entitySubtypeConstraints("entity_person", "person"),
);

export const coreEntityGroup = core.table(
	"entity_group",
	{
		id: uuid().primaryKey(),
		kind: coreEntityKind().default("group").notNull(),
		formedOn: date(),
		dissolvedOn: date(),
	},
	entitySubtypeConstraints("entity_group", "group"),
);

export const coreEntityOrganization = core.table(
	"entity_organization",
	{
		id: uuid().primaryKey(),
		kind: coreEntityKind().default("organization").notNull(),
		foundedOn: date(),
		dissolvedOn: date(),
	},
	entitySubtypeConstraints("entity_organization", "organization"),
);

// Reading-book: a book has editions (language, translators, cover…), models (tables of contents) shared by
// its editions, and readings made on an edition. See .scratch/reading-book-editions/spec.md
export const reading = snakeCase.schema("reading");

export const readingBook = reading.table("book", {
	id: uuid()
		.primaryKey()
		.references(() => coreNode.id, { onDelete: "cascade" }),
	title: text().notNull(),
	originalLanguage: text(),
	// year of the first publication
	originalYear: integer(),
	country: text(),
});

export const readingBookContributorRole = reading.enum("book_contributor_role", ["author", "illustrator", "preface"]);

export const readingBookContributor = reading.table(
	"book_contributor",
	{
		bookId: uuid()
			.notNull()
			.references(() => readingBook.id, { onDelete: "cascade" }),
		entityId: uuid()
			.notNull()
			.references(() => coreEntity.id),
		role: readingBookContributorRole().notNull(),
		// name printed on this book when it differs from the entity's (pseudonym…)
		creditedAs: text(),
		order: integer().default(0).notNull(),
	},
	(table) => [primaryKey({ columns: [table.bookId, table.entityId, table.role] }), index().on(table.entityId)],
);

export const readingModel = reading.table(
	"model",
	{
		id: uuid().primaryKey().defaultRandom(),
		bookId: uuid()
			.notNull()
			.references(() => readingBook.id, { onDelete: "cascade" }),
		name: text().notNull(),
		tree: jsonb().$type<ReadingModelItem[]>().default([]).notNull(),
	},
	(table) => [index().on(table.bookId)],
);

export const readingEditionType = reading.enum("edition_type", ["print", "digital"]);

export const readingEdition = reading.table(
	"edition",
	{
		id: uuid()
			.primaryKey()
			.references(() => coreNode.id, { onDelete: "cascade" }),
		bookId: uuid()
			.notNull()
			.references(() => readingBook.id, { onDelete: "cascade" }),
		// localized title, falls back to the book's
		title: text(),
		// an organization entity
		publisherId: uuid().references(() => coreEntity.id),
		// the publisher's collection ("Folio Classique")
		collection: text(),
		language: text(),
		pages: integer(),
		type: readingEditionType(),
		isbn: text(),
		year: integer(),
		coverKey: text(),
		modelId: uuid().references(() => readingModel.id),
		// the first edition is the book's main one until a reading is made
		createdAt: timestamp().defaultNow().notNull(),
	},
	(table) => [index().on(table.bookId), index().on(table.publisherId), index().on(table.modelId)],
);

export const readingEditionContributorRole = reading.enum("edition_contributor_role", ["translator"]);

export const readingEditionContributor = reading.table(
	"edition_contributor",
	{
		editionId: uuid()
			.notNull()
			.references(() => readingEdition.id, { onDelete: "cascade" }),
		entityId: uuid()
			.notNull()
			.references(() => coreEntity.id),
		role: readingEditionContributorRole().notNull(),
		creditedAs: text(),
		order: integer().default(0).notNull(),
	},
	(table) => [primaryKey({ columns: [table.editionId, table.entityId, table.role] }), index().on(table.entityId)],
);

export const readingStatus = reading.enum("status", ["in-progress", "complete", "abandoned"]);

export const readingReading = reading.table(
	"reading",
	{
		id: uuid().primaryKey().defaultRandom(),
		editionId: uuid()
			.notNull()
			.references(() => readingEdition.id, { onDelete: "cascade" }),
		status: readingStatus().default("in-progress").notNull(),
	},
	(table) => [index().on(table.editionId)],
);

// One row per chapter read on a given day (chapter_id = an item id of the edition's model tree)
export const readingEntry = reading.table(
	"entry",
	{
		readingId: uuid()
			.notNull()
			.references(() => readingReading.id, { onDelete: "cascade" }),
		chapterId: uuid().notNull(),
		date: date().notNull(),
		tags: text().array().default([]).notNull(),
	},
	(table) => [primaryKey({ columns: [table.readingId, table.chapterId, table.date] }), index().on(table.date)],
);

export const readingSeries = reading.table("series", {
	id: uuid()
		.primaryKey()
		.references(() => coreNode.id, { onDelete: "cascade" }),
	title: text().notNull(),
});

// What a series holds, in order: books and sub-series (a series of its own, possibly in several parents).
// The reading order over the whole tree ("#n") is computed, not stored.
export const readingSeriesItem = reading.table(
	"series_item",
	{
		seriesId: uuid()
			.notNull()
			.references(() => readingSeries.id, { onDelete: "cascade" }),
		// order within this level, rewritten 1..n on save
		position: integer().notNull(),
		// the only displayed value of this level: "2", "interlude"…
		positionLabel: text(),
		bookId: uuid().references(() => readingBook.id, { onDelete: "cascade" }),
		childSeriesId: uuid().references((): AnyPgColumn => readingSeries.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.seriesId, table.position] }),
		unique("series_item_series_id_book_id_key").on(table.seriesId, table.bookId),
		unique("series_item_series_id_child_series_id_key").on(table.seriesId, table.childSeriesId),
		index().on(table.bookId),
		index().on(table.childSeriesId),
		// a book or a sub-series
		check("series_item_one_kind_check", sql`num_nonnulls(${table.bookId}, ${table.childSeriesId}) = 1`),
	],
);

// Broadcast (podcasts, videos, radio and TV shows): a program's episodes are its releases, each listening/watching
// is a view. A `catalog` program stores every release, a `feed` one only the episodes with a view or a status.
// See .scratch/broadcast-postgres/spec.md
export const broadcast = snakeCase.schema("broadcast");

export const broadcastTracking = broadcast.enum("tracking", ["catalog", "feed"]);

export const broadcastProgram = broadcast.table("program", {
	id: uuid()
		.primaryKey()
		.references(() => coreNode.id, { onDelete: "cascade" }),
	name: text().notNull(),
	shortName: text(),
	description: text(),
	country: text(),
	type: text(),
	tracking: broadcastTracking().default("feed").notNull(),
	// the feeds read for the latest episodes, the sync and the catalog import
	rss: text(),
	youtubeChannelId: text(),
	youtubePlaylistId: text(),
	links: text().array().default([]).notNull(),
	profileKey: text(),
	bannerKey: text(),
	tags: text().array().default([]).notNull(),
	private: boolean().default(false).notNull(),
});

export const broadcastProgramContributorRole = broadcast.enum("program_contributor_role", [
	"host",
	"producer",
	"network",
]);

export const broadcastProgramContributor = broadcast.table(
	"program_contributor",
	{
		programId: uuid()
			.notNull()
			.references(() => broadcastProgram.id, { onDelete: "cascade" }),
		entityId: uuid()
			.notNull()
			.references(() => coreEntity.id),
		role: broadcastProgramContributorRole().notNull(),
		creditedAs: text(),
		order: integer().default(0).notNull(),
	},
	(table) => [primaryKey({ columns: [table.programId, table.entityId, table.role] }), index().on(table.entityId)],
);

// Time grouping of a program's episodes ("Saison 2", "2024-2025")
export const broadcastSeason = broadcast.table(
	"season",
	{
		id: uuid().primaryKey().defaultRandom(),
		programId: uuid()
			.notNull()
			.references(() => broadcastProgram.id, { onDelete: "cascade" }),
		position: integer().notNull(),
		label: text().notNull(),
	},
	(table) => [unique("season_program_id_position_key").on(table.programId, table.position)],
);

// Kind grouping of a program's episodes ("Vlog", "Review"), independent of the seasons
export const broadcastFormat = broadcast.table(
	"format",
	{
		id: uuid().primaryKey().defaultRandom(),
		programId: uuid()
			.notNull()
			.references(() => broadcastProgram.id, { onDelete: "cascade" }),
		label: text().notNull(),
		// display order of the groups
		position: integer().notNull(),
		// title regex giving this format to the imported and synced episodes
		match: text(),
	},
	(table) => [unique("format_program_id_label_key").on(table.programId, table.label)],
);

// planned = on the watchlist, skipped = not to watch; NULL otherwise ("watched" comes from the views)
export const broadcastEpisodeStatus = broadcast.enum("episode_status", ["planned", "skipped"]);

// A release. Its season and format belong to its program (checked by the service, not by the DB).
export const broadcastEpisode = broadcast.table(
	"episode",
	{
		id: uuid()
			.primaryKey()
			.references(() => coreNode.id, { onDelete: "cascade" }),
		programId: uuid()
			.notNull()
			.references(() => broadcastProgram.id, { onDelete: "cascade" }),
		seasonId: uuid().references(() => broadcastSeason.id, { onDelete: "set null" }),
		formatId: uuid().references(() => broadcastFormat.id, { onDelete: "set null" }),
		// order within the season, when the source gives one
		position: integer(),
		// the only displayed number: "12", "bonus", "Vlog 5"
		numberLabel: text(),
		name: text().notNull(),
		shortName: text(),
		type: text(),
		// unknown for the episodes migrated from Mongo (only the listening date was kept)
		releaseDate: date(),
		// minutes
		duration: integer(),
		link: text(),
		// plain text (a feed's HTML converted)
		description: text(),
		// S3 key of the cover (served by /images/broadcast/episode/:id)
		coverKey: text(),
		// RSS guid / YouTube videoId: unique within the program only
		externalId: text(),
		tags: text().array().default([]).notNull(),
		// program tags not applied to this episode
		ignoredTags: text().array().default([]).notNull(),
		status: broadcastEpisodeStatus(),
	},
	(table) => [
		unique("episode_program_id_external_id_key").on(table.programId, table.externalId),
		index().on(table.programId, table.releaseDate),
		index().on(table.seasonId),
		index().on(table.formatId),
	],
);

export const broadcastEpisodeContributorRole = broadcast.enum("episode_contributor_role", [
	"host",
	"guest",
	"interviewee",
]);

export const broadcastEpisodeContributor = broadcast.table(
	"episode_contributor",
	{
		episodeId: uuid()
			.notNull()
			.references(() => broadcastEpisode.id, { onDelete: "cascade" }),
		entityId: uuid()
			.notNull()
			.references(() => coreEntity.id),
		role: broadcastEpisodeContributorRole().notNull(),
		creditedAs: text(),
		order: integer().default(0).notNull(),
	},
	(table) => [primaryKey({ columns: [table.episodeId, table.entityId, table.role] }), index().on(table.entityId)],
);

// One listening/watching of an episode
export const broadcastView = broadcast.table(
	"view",
	{
		id: uuid().primaryKey().defaultRandom(),
		episodeId: uuid()
			.notNull()
			.references(() => broadcastEpisode.id, { onDelete: "cascade" }),
		date: date().notNull(),
		// minutes watched; NULL = the whole episode
		duration: integer(),
		contextTags: text().array().default([]).notNull(),
		comment: text(),
		createdAt: localTimestamp()
			.default(sql`now()`)
			.notNull(),
	},
	(table) => [index().on(table.episodeId), index().on(table.date)],
);
