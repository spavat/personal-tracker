import type { SaveCastingBodyRequestSchema, SavePerformanceBodyRequestSchema } from "@personal-tracker/shared/show";
import type { z } from "zod";

export type SavePerformanceBody = z.infer<typeof SavePerformanceBodyRequestSchema>;
export type SaveCastingBody = z.infer<typeof SaveCastingBodyRequestSchema>;
