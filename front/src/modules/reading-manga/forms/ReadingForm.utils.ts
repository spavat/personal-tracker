import { SaveReadingBodyRequestSchema } from "@personal-tracker/shared/reading-manga";
import z from "zod";

const ReadingInsideFormSchema = SaveReadingBodyRequestSchema.extend({
	name: z.string().nonempty(),
	language: z.string().nonempty(),
	contextTags: z.array(z.object({ value: z.string().nonempty() })),
});

export const ReadingDataTransformation = SaveReadingBodyRequestSchema.transform((data) => ({
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
