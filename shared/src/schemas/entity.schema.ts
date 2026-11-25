import * as z from "zod";

import { SearchQSSchema, SortQSSchema } from "./common.schema";

// People, groups and organizations shared by every module (authors, translators, publishers, artists…)
export const EntityKindSchema = z.enum(["person", "group", "organization"]);
export type EntityKind = z.infer<typeof EntityKindSchema>;

export const EntitySchema = z.object({
	id: z.uuid(),
	kind: EntityKindSchema,
	name: z.string().trim().nonempty(),
	sortName: z.string().trim().nonempty().nullable(),
	// portrait (square), served through /images/entity/:id
	picture: z.string().nullable(),
});
export type Entity = z.infer<typeof EntitySchema>;

//
// LIST
//
export const EntityListQuerystringRequestSchema = SearchQSSchema.extend({
	kind: EntityKindSchema.optional(),
});
export const EntityListResponseSchema = z.array(EntitySchema);

//
// SAVE
//
// Creates the entity when no id is given. Another kind on update moves the entity to it (its credits are kept, the
// fields of its former kind are lost).
// `picture`: the URL given by the server or left out = unchanged, another URL or a data URI = new portrait,
// null = no portrait
export const SaveEntityBodyRequestSchema = EntitySchema.omit({ id: true }).extend({
	sortName: EntitySchema.shape.sortName.default(null),
	picture: EntitySchema.shape.picture.optional(),
});
export type SaveEntityBody = z.infer<typeof SaveEntityBodyRequestSchema>;
export const SaveEntityResponseSchema = EntitySchema;
export const EntityParamsRequestSchema = z.object({ id: z.uuid() });

//
// DIRECTORY
//
// Every entity with what it is credited for, module by module: the distinct works (a book with two roles counts once
// in `books`) and the works of each role. A visitor only sees the entities with a visible credit, and only those
// credits are counted.
export const EntityDirectoryItemSchema = EntitySchema.extend({
	// on the book (author, illustrator, preface) or on one of its editions (translator, publisher)
	book: z.object({
		books: z.number(),
		author: z.number(),
		illustrator: z.number(),
		preface: z.number(),
		translator: z.number(),
		publisher: z.number(),
	}),
	// spectacles: through a performance or a cast model
	show: z.object({ spectacles: z.number(), performances: z.number() }),
	program: z.object({ programs: z.number(), host: z.number(), producer: z.number(), network: z.number() }),
	episode: z.object({ episodes: z.number(), host: z.number(), guest: z.number(), interviewee: z.number() }),
});
export type EntityDirectoryItem = z.infer<typeof EntityDirectoryItemSchema>;
// search: in the names (the search modal)
export const EntityDirectoryQuerystringRequestSchema = SortQSSchema.extend(SearchQSSchema.shape);
export const EntityDirectoryResponseSchema = z.array(EntityDirectoryItemSchema);

//
// MERGE
//
// The main entity (keepId) gets every credit of the secondary one (removeId), which is then deleted
export const EntityMergeBodySchema = z
	.object({ keepId: z.uuid(), removeId: z.uuid() })
	.refine(({ keepId, removeId }) => keepId !== removeId, { message: "two different entities", path: ["removeId"] });
export type EntityMergeBody = z.infer<typeof EntityMergeBodySchema>;
