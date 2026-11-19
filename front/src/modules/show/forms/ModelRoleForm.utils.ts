import { ModelSchema, SaveModelBodyRequestSchema } from "@personal-tracker/shared/show";
import z from "zod";

// the id of the edited record (none: created); the api sends it in the path
export const ModelFormSchema = SaveModelBodyRequestSchema.extend({ id: ModelSchema.shape.id.optional() });

export type ModelForm = z.infer<typeof ModelFormSchema>;

export const onSubmitModel = (data: ModelForm) => {
	const dataToSend = ModelFormSchema.parse(data);
	return { ...dataToSend, roles: dataToSend.roles.map((role, index) => ({ ...role, order: index + 1 })) };
};
