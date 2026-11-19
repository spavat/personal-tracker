import { PlaceSchema, SavePlaceBodyRequestSchema } from "@personal-tracker/shared/show";
import z from "zod";

// the id of the edited record (none: created); the api sends it in the path
const PlaceInsideFormSchema = SavePlaceBodyRequestSchema.extend({ id: PlaceSchema.shape.id.optional() });

export const PlaceFormSchema = z.object({
	place: PlaceInsideFormSchema,
});
export type PlaceForm = z.infer<typeof PlaceFormSchema>;

export const PlaceFormSchemaTransformation = PlaceInsideFormSchema;

export const onSubmitPlace = (data: PlaceForm) => {
	// formerNames is missing when no former name was ever added to a new place
	return PlaceFormSchemaTransformation.parse({ ...data.place, formerNames: data.place.formerNames ?? [] });
};
