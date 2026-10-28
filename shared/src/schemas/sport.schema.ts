import * as z from "zod";

import { OptionalPeriodQSSchema, UUIDParamsSchema } from "./common.schema";

export const SportDetailsSchema = z.object({
	movingDuration: z.number(),
	totalDuration: z.number(),
	distance: z.number(),
	pace: z.number(),
	elevationGain: z.number().optional(),
	elevationLoss: z.number().optional(),
});

export const TrackPointSchema = z.object({
	id: z.string(),
	lat: z.number(),
	lon: z.number(),
	ele: z.number().nullable().optional(),
	time: z.string().nullable().optional(),
	distanceFromStart: z.number().optional(),
	pace: z.number().optional(),
	isSuspect: z.boolean().optional(),
});

// A marker at `time` (seconds elapsed from activity start) starting a segment of the given
// type, lasting until the next marker (or activity end). Two consecutive markers of the same
// type just split a segment for pace measurement, without changing its label.
export const SegmentSchema = z.object({
	time: z.number().nonnegative(),
	type: z.enum(["running", "pause"]),
	label: z.string().optional(),
});

export const SportActivitySchema = z.object({
	id: z.uuidv4(),
	name: z.string(),
	type: z.string(),
	date: z.iso.datetime({ local: true }),
	created: z.string(),
	details: SportDetailsSchema,
	comment: z.string().optional(),
	rawData: z.string().optional(),
	gpxKey: z.string().optional(),
	thumbnailKey: z.string().optional(),
	points: z.array(TrackPointSchema).optional(),
	segments: z.array(SegmentSchema).optional(),
});

export type SportActivity = z.infer<typeof SportActivitySchema>;
export type SportDetails = z.infer<typeof SportDetailsSchema>;
export type TrackPoint = z.infer<typeof TrackPointSchema>;
export type Segment = z.infer<typeof SegmentSchema>;

//
// LIST
//
export const ListQuerystringRequestSchema = OptionalPeriodQSSchema;
export const ListResponseSchema = z.array(SportActivitySchema);

//
// DETAILS
//
export const DetailsQuerystringRequestSchema = UUIDParamsSchema;
export const DetailsResponseSchema = SportActivitySchema;

//
// SAVE
//
export const SaveBodyRequestSchema = SportActivitySchema.partial({ id: true, date: true })
	.omit({
		created: true,
		points: true,
		segments: true,
	})
	.extend({
		date: z.iso.datetime({ local: true }).optional(),
	});
export type SaveBodyRequest = z.infer<typeof SaveBodyRequestSchema>;
//
// DELETE
//
export const DeleteParamsRequestSchema = UUIDParamsSchema;
export type DeleteParamsRequest = z.infer<typeof DeleteParamsRequestSchema>;

//
// UPDATE SEGMENTS
//
export const UpdateSegmentsBodyRequestSchema = z
	.object({
		id: z.uuidv4(),
		segments: z.array(SegmentSchema),
	})
	.refine((data) => new Set(data.segments.map((s) => s.time)).size === data.segments.length, {
		message: "Segment times must be unique",
		path: ["segments"],
	});
export type UpdateSegmentsBodyRequest = z.infer<typeof UpdateSegmentsBodyRequestSchema>;

//
// CROP
//
export const CropBodyRequestSchema = z
	.object({
		id: z.uuidv4(),
		startIndex: z.number().int().nonnegative(),
		endIndex: z.number().int().nonnegative(),
	})
	.refine((data) => data.startIndex < data.endIndex, {
		message: "startIndex must be before endIndex",
		path: ["endIndex"],
	});
export type CropBodyRequest = z.infer<typeof CropBodyRequestSchema>;
