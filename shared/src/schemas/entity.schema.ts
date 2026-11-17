import * as z from "zod";

import { SearchQSSchema } from "./common.schema";

// People, groups and organizations shared by every module (authors, translators, publishers, artists…)
export const EntityKindSchema = z.enum(["person", "group", "organization"]);
export type EntityKind = z.infer<typeof EntityKindSchema>;

export const EntitySchema = z.object({
	id: z.uuid(),
	kind: EntityKindSchema,
	name: z.string().trim().nonempty(),
	sortName: z.string().trim().nonempty().nullable(),
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
// Creates the entity when no id is given. The kind can't change on update.
export const SaveEntityBodyRequestSchema = EntitySchema.partial({ id: true }).extend({
	sortName: EntitySchema.shape.sortName.default(null),
});
export type SaveEntityBody = z.infer<typeof SaveEntityBodyRequestSchema>;
export const SaveEntityResponseSchema = EntitySchema;
