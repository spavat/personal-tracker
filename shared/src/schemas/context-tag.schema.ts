import * as z from "zod";

import { UUIDParamsSchema } from "./common.schema";

export const ContextTagSchema = z.object({
	id: z.uuidv4(),
	name: z.string(),
	tags: z.array(z.string()),
});

export type ContextTag = z.infer<typeof ContextTagSchema>;

//
// LIST
//
// Response
export const ListResponseSchema = z.array(ContextTagSchema);

//
// SAVE
//
export const SaveContextTagRequestSchema = ContextTagSchema.partial({ id: true });

//
// DELETE
//
// Request
export const DeleteContextTagParamsRequestSchema = UUIDParamsSchema;
