import * as z from "zod";

import { SearchQSSchema, SortQSSchema, UUIDParamsSchema } from "./common.schema";

//
// CATEGORY
//
export const LifespanCategorySchema = z.object({
	id: z.uuidv4(),
	name: z.string().nonempty(),
	parentId: z.uuidv4().nullable(),
});
export type LifespanCategory = z.infer<typeof LifespanCategorySchema>;

//
// LIST CATEGORIES
//
// Response
export const LifespanCategoryListResponseSchema = z.array(LifespanCategorySchema);

//
// SAVE CATEGORY
//
// Request
export const LifespanCategorySaveBodyRequestSchema = LifespanCategorySchema.partial({ id: true });
export type LifespanCategorySaveBodyRequestType = z.infer<typeof LifespanCategorySaveBodyRequestSchema>;

//
// DELETE CATEGORY
//
// Request
export const LifespanCategoryDeleteParamsRequestSchema = UUIDParamsSchema;

//
// EVENT
//
export const LifespanEventTypeSchema = z.enum([
	"bought",
	"received",
	"start_usage",
	"pause_usage",
	"end_usage",
	"dispose",
	"note",
]);
export type LifespanEventType = z.infer<typeof LifespanEventTypeSchema>;

export const LifespanDisposeCauseSchema = z.enum(["thrown", "given_away", "sold", "lost", "recycled", "other"]);
export type LifespanDisposeCause = z.infer<typeof LifespanDisposeCauseSchema>;

const LifespanEventShapeSchema = z.object({
	id: z.uuidv4(),
	type: LifespanEventTypeSchema,
	date: z.iso.date(),
	cause: LifespanDisposeCauseSchema.optional(),
	comment: z.string().optional(),
	created: z.iso.datetime({ local: true }).optional(),
});

// cause is required when (and only when) the event is a dispose event
function hasCauseOnlyWhenDisposed(event: { type: LifespanEventType; cause?: LifespanDisposeCause }) {
	return (event.type === "dispose") === (event.cause !== undefined);
}
const disposeCauseRefinementOptions = {
	path: ["cause"] as PropertyKey[],
	message: "cause is required when type is 'dispose', and must be omitted otherwise",
};

export const LifespanEventSchema = LifespanEventShapeSchema.refine(
	hasCauseOnlyWhenDisposed,
	disposeCauseRefinementOptions,
);
export type LifespanEvent = z.infer<typeof LifespanEventSchema>;

// Save request shape: id is generated server-side when absent (mirrors GamePlaySchema.partial({ id: true }))
export const LifespanEventSaveSchema = LifespanEventShapeSchema.partial({ id: true }).refine(
	hasCauseOnlyWhenDisposed,
	disposeCauseRefinementOptions,
);
export type LifespanEventSaveType = z.infer<typeof LifespanEventSaveSchema>;

//
// OBJECT
//
export const LifespanObjectSchema = z.object({
	id: z.uuidv4(),
	name: z.string().nonempty(),
	description: z.string().optional(),
	// free text sub-grouping inside a category (e.g. "mouse", "keyboard"), no need to create a category
	type: z.string().optional(),
	categoryId: z.uuidv4(),
	events: z.array(LifespanEventSchema),
});
export type LifespanObject = z.infer<typeof LifespanObjectSchema>;

export const LifespanUsageStatusSchema = z.enum(["not_started", "in_use", "paused", "ended"]);
export type LifespanUsageStatus = z.infer<typeof LifespanUsageStatusSchema>;

export const LifespanPossessionStatusSchema = z.enum(["owned", "disposed"]);
export type LifespanPossessionStatus = z.infer<typeof LifespanPossessionStatusSchema>;

export const LifespanObjectWithStatusSchema = LifespanObjectSchema.extend({
	usageStatus: LifespanUsageStatusSchema,
	possessionStatus: LifespanPossessionStatusSchema,
});
export type LifespanObjectWithStatus = z.infer<typeof LifespanObjectWithStatusSchema>;

//
// LIST OBJECTS
//
export const LifespanObjectListQuerystringRequestSchema = SortQSSchema.extend(SearchQSSchema.shape).extend({
	categoryId: z.uuid().optional(),
});
export type LifespanObjectListQuerystringRequestType = z.infer<typeof LifespanObjectListQuerystringRequestSchema>;

//
// DETAILS OBJECT
//
export const LifespanObjectDetailsParamsRequestSchema = z.object({
	id: z.uuid(),
});

//
// SAVE (object and/or event, mirrors GameSaveBodyRequestSchema)
//
// Request
export const LifespanObjectSaveBodyRequestSchema = z
	.object({
		object: LifespanObjectSchema.partial({ id: true }).omit({ events: true }).optional(),
		events: z.array(LifespanEventSaveSchema).optional(),
		event: LifespanEventSaveSchema.optional(),
		objectId: z.string().optional(),
	})
	.refine(({ object, event, events, objectId }) => {
		if (object && !objectId && !event) {
			return true; // Add object (with or without initial events)
		}
		if (event && objectId && !events) {
			return true; // Add or update a single event on an existing object
		}
		return false;
	});
export type LifespanObjectSaveBodyRequestType = z.infer<typeof LifespanObjectSaveBodyRequestSchema>;

//
// DELETE EVENT
//
// Request
export const LifespanEventDeleteParamsRequestSchema = z.object({
	objectId: z.uuid(),
	eventId: z.uuid(),
});
export type LifespanEventDeleteParamsRequestType = z.infer<typeof LifespanEventDeleteParamsRequestSchema>;

//
// DELETE OBJECT
//
// Request
export const LifespanObjectDeleteParamsRequestSchema = UUIDParamsSchema;
