import { BookSchema, SaveBookRequestSchema } from "@personal-tracker/shared/reading-book";
import { z } from "zod";

// an author row: an entity picked (or created), and the name printed on the book when it differs; `hint`: the
// name given by an Open Library result, to look for in the picker (not saved)
export const BookFormSchema = SaveBookRequestSchema.extend({
	// the edited book (none: created); the api sends it in the path
	id: BookSchema.shape.id.optional(),
	authors: z
		.array(z.object({ entityId: z.string().nonempty(), creditedAs: z.string(), hint: z.string().optional() }))
		.min(1),
});
export const BookFormSchemaTransformation = BookFormSchema.transform((data) => ({
	...data,
	authors: data.authors.map(({ entityId, creditedAs }) => ({ entityId, creditedAs: creditedAs.trim() || null })),
}));

export type FormData = z.input<typeof BookFormSchema>;
