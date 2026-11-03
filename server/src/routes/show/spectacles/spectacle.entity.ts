import type { SaveSpectacleBodyRequestSchema } from "@personal-tracker/shared/show";
import type { z } from "zod";

export type SaveSpectacleBody = z.infer<typeof SaveSpectacleBodyRequestSchema>;
