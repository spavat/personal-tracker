import type { SaveWorkBodyRequestSchema } from "@shared/dist/schemas/show.schema";
import type { z } from "zod";

export type SaveWorkBody = z.infer<typeof SaveWorkBodyRequestSchema>;
