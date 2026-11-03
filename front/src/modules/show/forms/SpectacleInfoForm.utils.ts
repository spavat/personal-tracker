import { SaveSpectacleBodyRequestSchema, SpectacleDetailsResponse } from "@personal-tracker/shared/show";
import z from "zod";

// an empty input is stored as null
const emptyToNull = (val: unknown) => (val === "" ? null : val);

const SpectacleInfoInsideFormSchema = SaveSpectacleBodyRequestSchema.omit({ models: true }).extend({
	description: z.preprocess(emptyToNull, z.string().nullable()),
	descriptionSource: z.preprocess(emptyToNull, z.url().nullable()),
	tracklist: z.preprocess(emptyToNull, z.string().nullable()),
});

export const SpectacleInfoFormSchema = z.object({
	spectacle: SpectacleInfoInsideFormSchema,
});
export type SpectacleInfoForm = z.infer<typeof SpectacleInfoFormSchema>;

export const toSpectacleInfoForm = (data: SpectacleDetailsResponse): SpectacleInfoForm => ({
	spectacle: {
		id: data.id,
		name: data.name,
		workId: data.workId,
		description: data.description ?? "",
		descriptionSource: data.descriptionSource ?? "",
		links: data.links ?? [],
		tracklist: data.tracklist ?? "",
	},
});
