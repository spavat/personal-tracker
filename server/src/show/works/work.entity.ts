import type { SaveWorkBodyRequestSchema } from "@personal-tracker/shared/show";
import type { z } from "zod";

// the body, with the id of the path on an update (none: created)
export type SaveWorkBody = z.infer<typeof SaveWorkBodyRequestSchema> & { id?: string };
