import { SaveArtistBodyRequestSchema } from "@personal-tracker/shared/show";
import z from "zod";

const ArtistInsideFormSchema = SaveArtistBodyRequestSchema;

export const ArtistFormSchema = z.object({
	artist: ArtistInsideFormSchema,
});
export type ArtistForm = z.infer<typeof ArtistFormSchema>;

export const ArtistFormSchemaTransformation = ArtistInsideFormSchema;

export const onSubmitArtist = (data: ArtistForm) => {
	return ArtistFormSchemaTransformation.parse(data.artist);
};
