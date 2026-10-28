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
} from "drizzle-orm/pg-core";

export const money = snakeCase.schema("money");
export const show = snakeCase.schema("show");
export const auth = snakeCase.schema("auth");

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

export const showArtist = show.table("artist", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	name: varchar({ length: 100 }),
});

export const showModel = show.table("model", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	name: varchar({ length: 100 }),
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
	},
	(table) => [index().on(table.artistId), index().on(table.modelId)],
);

export const showCastingStatus = show.enum("casting_status", ["tbd", "unknown", "partial", "complete"]);
export const showCastingOrigin = show.enum("casting_origin", ["na", "program", "performance"]);

export const showPerformance = show.table(
	"performance",
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		date: timestamp({ mode: "string" }).notNull(),
		placeId: integer().references(() => showPlace.id),
		spectacleId: integer()
			.notNull()
			.references(() => showSpectacle.id),
		canceled: boolean().default(false).notNull(),
		seat: varchar({ length: 45 }).default("").notNull(),
		casting_status: showCastingStatus().default("tbd").notNull(),
		casting_origin: showCastingOrigin().default("na").notNull(),
	},
	(table) => [index().on(table.placeId), index().on(table.spectacleId)],
);

export const showPlace = show.table("place", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	name: varchar({ length: 100 }),
	address: text(),
	country: varchar({ length: 2 }),
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

export const showRole = show.table("role", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	artistId: integer().references(() => showArtist.id),
	performanceId: integer().references(() => showPerformance.id),
	name: varchar({ length: 100 }),
	status: varchar({ length: 45 }),
	main: boolean().default(false),
	order: integer(),
});

export const showSpectacle = show.table(
	"spectacle",
	{
		id: integer().primaryKey().generatedByDefaultAsIdentity(),
		name: varchar({ length: 100 }).notNull(),
		workId: integer()
			.notNull()
			.references(() => showWork.id),
	},
	(table) => [index().on(table.workId)],
);

export const showWork = show.table("work", {
	id: integer().primaryKey().generatedByDefaultAsIdentity(),
	name: varchar({ length: 100 }).notNull(),
});

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
