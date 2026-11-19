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

export const showArtist = show.table(
	"artist",
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		name: varchar({ length: 100 }),
		pictureId: uuid(),
	},
	(table) => [
		foreignKey({
			name: "artist_main_picture_fkey",
			columns: [table.id, table.pictureId],
			foreignColumns: [showArtistMedia.artistId, showArtistMedia.mediaId],
		}),
	],
);

export const showModel = show.table("model", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	name: varchar({ length: 100 }).notNull(),
	spectacleId: integer()
		.notNull()
		.references(() => showSpectacle.id),
});

export const showModelRole = show.table(
	"model_role",
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		name: varchar({ length: 100 }),
		main: boolean(),
		artistId: integer().references(() => showArtist.id),
		modelId: integer().references(() => showModel.id),
		order: integer(),
		pictureId: uuid(),
	},
	(table) => [
		index().on(table.artistId),
		index().on(table.modelId),
		foreignKey({
			name: "model_role_picture_fkey",
			columns: [table.artistId, table.pictureId],
			foreignColumns: [showArtistMedia.artistId, showArtistMedia.mediaId],
		}),
	],
);

export const showCastingStatus = show.enum("casting_status", ["tbd", "unknown", "partial", "complete"]);
export const showCastingOrigin = show.enum("casting_origin", ["na", "program", "performance"]);

export const showPerformance = show.table(
	"performance",
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		date: localTimestamp().notNull(),
		placeId: integer().references(() => showPlace.id),
		spectacleId: integer()
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
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	name: varchar({ length: 100 }).notNull(),
	address: text().notNull(),
	country: varchar({ length: 2 }).notNull(),
	link: varchar({ length: 100 }),
});

export const showPlaceFormerName = show.table(
	"place_former_name",
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		placeId: integer()
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
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		artistId: integer().references(() => showArtist.id),
		performanceId: integer().references(() => showPerformance.id),
		name: varchar({ length: 100 }),
		status: varchar({ length: 45 }),
		main: boolean().default(false),
		order: integer(),
		pictureId: uuid(),
	},
	(table) => [
		foreignKey({
			name: "role_picture_fkey",
			columns: [table.artistId, table.pictureId],
			foreignColumns: [showArtistMedia.artistId, showArtistMedia.mediaId],
		}),
	],
);

export const showSpectacle = show.table(
	"spectacle",
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		name: varchar({ length: 100 }).notNull(),
		workId: integer()
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
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
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
		spectacleId: integer()
			.notNull()
			.references(() => showSpectacle.id, { onDelete: "cascade" }),
		mediaId: uuid()
			.notNull()
			.references(() => showMedia.id, { onDelete: "cascade" }),
		kind: showSpectacleMediaKind().default("poster").notNull(),
	},
	(table) => [primaryKey({ columns: [table.spectacleId, table.mediaId] }), index().on(table.mediaId)],
);

export const showArtistMedia = show.table(
	"artist_media",
	{
		artistId: integer()
			.notNull()
			// annotated: artist.pictureId points back to this table
			.references((): AnyPgColumn => showArtist.id, { onDelete: "cascade" }),
		mediaId: uuid()
			.notNull()
			.references(() => showMedia.id, { onDelete: "cascade" }),
		// optional context: portrait taken for a given spectacle
		spectacleId: integer().references(() => showSpectacle.id, { onDelete: "set null" }),
	},
	(table) => [primaryKey({ columns: [table.artistId, table.mediaId] }), index().on(table.mediaId)],
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
export const coreNodeType = core.enum("node_type", ["entity", "book", "book_series"]);

export const coreNode = core.table("node", {
	id: uuid().primaryKey().defaultRandom(),
	type: coreNodeType().notNull(),
	// display name, kept in sync with the row it stands for (search, link lists)
	label: text().notNull(),
});

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
		id: uuid().primaryKey().defaultRandom(),
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
