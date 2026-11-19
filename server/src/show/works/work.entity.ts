import type { SaveWorkBodyRequestSchema } from "@personal-tracker/shared/show";
import type { z } from "zod";

export type SaveWorkBody = z.infer<typeof SaveWorkBodyRequestSchema>;
