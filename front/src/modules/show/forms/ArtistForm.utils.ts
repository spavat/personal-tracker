import { ArtistSchema, SaveArtistBodyRequestSchema } from "@personal-tracker/shared/show";
import z from "zod";

// the id of the edited record (none: created); the api sends it in the path
const ArtistInsideFormSchema = SaveArtistBodyRequestSchema.extend({ id: ArtistSchema.shape.id.optional() });

export const ArtistFormSchema = z.object({
	artist: ArtistInsideFormSchema,
});
export type ArtistForm = z.infer<typeof ArtistFormSchema>;

export const ArtistFormSchemaTransformation = ArtistInsideFormSchema;

export const onSubmitArtist = (data: ArtistForm) => {
	return ArtistFormSchemaTransformation.parse(data.artist);
};
