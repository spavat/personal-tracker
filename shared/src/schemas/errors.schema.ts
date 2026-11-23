import * as z from "zod";

// What the front reads to show an error (see .scratch/error-codes/spec.md); `message` is English, for logs
export const ErrorCodeSchema = z.enum([
	"not_found",
	"has_dependents",
	"sync_in_progress",
	"upstream_unavailable",
	"invalid_image",
	"invalid_reference",
	"cycle",
	"duplicate_items",
	"external_id_taken",
	"book.last_edition",
	"edition.model_locked",
	"game.merge_self",
	"game.replay_too_old",
	"broadcast.no_feed",
	"sport.gpx_no_date",
	"sport.date_required",
	"sport.no_gpx",
	"sport.crop_out_of_range",
	"validation",
	"unauthorized",
	"http_error",
	"internal",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

// The resources a `not_found` (and the other codes with a `resource`) can name
export const ErrorResourceSchema = z.enum([
	"account",
	"activity",
	"artist",
	"author",
	"bank",
	"book",
	"category",
	"context_tag",
	"cover",
	"edition",
	"entity",
	"episode",
	"event",
	"game",
	"genre",
	"image",
	"lifespan_category",
	"listening",
	"manga",
	"media",
	"model",
	"object",
	"organization",
	"payment_type",
	"performance",
	"person",
	"place",
	"play",
	"portrait",
	"poster",
	"program",
	"proposal",
	"reading",
	"series",
	"spectacle",
	"store",
	"tag",
	"transaction",
	"work",
]);
export type ErrorResource = z.infer<typeof ErrorResourceSchema>;

export const ErrorParamsSchema = z.record(z.string(), z.union([z.string(), z.number()]));
export type ErrorParams = z.infer<typeof ErrorParamsSchema>;

export const ErrorIssueSchema = z.object({
	path: z.array(z.union([z.string(), z.number()])),
	code: z.string().optional(),
	message: z.string(),
});
export type ErrorIssue = z.infer<typeof ErrorIssueSchema>;

export const ErrorBodySchema = z.object({
	statusCode: z.number(),
	code: ErrorCodeSchema,
	message: z.string(),
	params: ErrorParamsSchema.optional(),
	issues: z.array(ErrorIssueSchema).optional(),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;
