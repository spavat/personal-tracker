import { SaveMangaBodyRequestSchema } from "@personal-tracker/shared/reading-manga";
import z from "zod";

const MangaInsideFormSchema = SaveMangaBodyRequestSchema.extend({
	author: z.array(z.object({ value: z.string().nonempty() })),
	art: z.array(z.object({ value: z.string().nonempty() })),
	scenario: z.array(z.object({ value: z.string().nonempty() })),
	genres: z.array(z.object({ value: z.string().nonempty() })),
});

export const MangaDataTransformation = SaveMangaBodyRequestSchema.transform((data) => ({
	...data,
	author: data?.author?.map((author: string) => ({ value: author })) ?? [],
	art: data?.art?.map((art: string) => ({ value: art })) ?? [],
	scenario: data?.scenario?.map((scenario: string) => ({ value: scenario })) ?? [],
	genres: data?.genres?.map((genre: string) => ({ value: genre })) ?? [],
}));

export const MangaFormSchema = z.object({
	manga: MangaInsideFormSchema,
});
export type MangaForm = z.infer<typeof MangaFormSchema>;

const MangaFormSchemaTransformation = MangaInsideFormSchema.transform((data) => ({
	...data,
	author: (data.author ?? []).map((author) => author.value),
	art: (data.art ?? []).map((art) => art.value),
	scenario: (data.scenario ?? []).map((scenario) => scenario.value),
	genres: (data.genres ?? []).map((genre) => genre.value),
}));

export const onSubmitManga = (data: MangaForm) => {
	return MangaFormSchemaTransformation.parse(data.manga);
};
