import { ReadingSchema, SaveReadingBodyRequestSchema } from "@personal-tracker/shared/reading-manga";
import z from "zod";

// the id of the edited record (none: created); the api sends it in the path
const ReadingWithIdSchema = SaveReadingBodyRequestSchema.extend({ id: ReadingSchema.shape.id.optional() });

const ReadingInsideFormSchema = ReadingWithIdSchema.extend({
	name: z.string().nonempty(),
	language: z.string().nonempty(),
	contextTags: z.array(z.object({ value: z.string().nonempty() })),
});

export const ReadingDataTransformation = ReadingWithIdSchema.transform((data) => ({
	...data,
	contextTags: data?.contextTags?.map((tag: string) => ({ value: tag })) ?? [],
}));

export const ReadingFormSchema = z.object({
	reading: ReadingInsideFormSchema,
});
export type ReadingForm = z.infer<typeof ReadingFormSchema>;

const ReadingFormSchemaTransformation = ReadingInsideFormSchema.transform((data) => ({
	...data,
	contextTags: (data.contextTags ?? []).map((tag) => tag.value),
}));
export const onSubmitReading = (data: ReadingForm) => {
	console.log("data", data);
	return ReadingFormSchemaTransformation.parse(data.reading);
};
