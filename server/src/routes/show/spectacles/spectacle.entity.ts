import type { SaveSpectacleBodyRequestSchema } from "@shared/dist/schemas/show.schema";
import type { z } from "zod";

export type SaveSpectacleBody = z.infer<typeof SaveSpectacleBodyRequestSchema>;
