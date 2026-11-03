import { z } from "zod";

export const withReturnToSchema = z.object({
	returnTo: z.string(),
});
