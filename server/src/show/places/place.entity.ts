import type { SavePlaceBodyRequestSchema } from "@personal-tracker/shared/show";
import type { z } from "zod";

// the body, with the id of the path on an update (none: created)
export type SavePlaceBody = z.infer<typeof SavePlaceBodyRequestSchema> & { id?: number };
