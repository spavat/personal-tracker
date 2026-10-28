import { SavePlaceBodyRequestSchema } from "@personal-tracker/shared/show";
import z from "zod";

const PlaceInsideFormSchema = SavePlaceBodyRequestSchema;

export const PlaceFormSchema = z.object({
	place: PlaceInsideFormSchema,
});
export type PlaceForm = z.infer<typeof PlaceFormSchema>;

export const PlaceFormSchemaTransformation = PlaceInsideFormSchema;

export const onSubmitPlace = (data: PlaceForm) => {
	// formerNames is missing when no former name was ever added to a new place
	return PlaceFormSchemaTransformation.parse({ ...data.place, formerNames: data.place.formerNames ?? [] });
};
