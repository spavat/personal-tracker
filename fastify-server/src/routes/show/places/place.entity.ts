import type { SavePlaceBodyRequestSchema } from "@personal-tracker/shared/show";
import type { z } from "zod";

export type SavePlaceBody = z.infer<typeof SavePlaceBodyRequestSchema>;
