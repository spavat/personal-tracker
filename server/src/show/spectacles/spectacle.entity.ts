import type { SaveSpectacleBodyRequestSchema } from "@personal-tracker/shared/show";
import type { z } from "zod";

// the body, with the id of the path on an update (none: created)
export type SaveSpectacleBody = z.infer<typeof SaveSpectacleBodyRequestSchema> & { id?: number };
