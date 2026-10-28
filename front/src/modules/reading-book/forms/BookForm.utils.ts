import { SaveBookRequestSchema } from "@personal-tracker/shared/reading-book";
import { z } from "zod";

export const BookFormSchema = SaveBookRequestSchema.extend({
	author: z.array(z.object({ value: z.string().nonempty() })).min(1),
});
export const BookFormSchemaTransformation = BookFormSchema.transform((data) => ({
	...data,
	author: (data.author ?? []).map((author) => author.value),
}));

export type FormData = z.input<typeof BookFormSchema>;
