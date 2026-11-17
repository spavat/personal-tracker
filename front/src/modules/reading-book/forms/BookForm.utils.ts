import { SaveBookRequestSchema } from "@personal-tracker/shared/reading-book";
import { z } from "zod";

// an author row: an entity picked (or created), and the name printed on the book when it differs
export const BookFormSchema = SaveBookRequestSchema.extend({
	authors: z.array(z.object({ entityId: z.string().nonempty(), creditedAs: z.string() })).min(1),
});
export const BookFormSchemaTransformation = BookFormSchema.transform((data) => ({
	...data,
	authors: data.authors.map(({ entityId, creditedAs }) => ({ entityId, creditedAs: creditedAs.trim() || null })),
}));

export type FormData = z.input<typeof BookFormSchema>;
