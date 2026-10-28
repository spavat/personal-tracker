import { SaveModelBodyRequestSchema } from "@personal-tracker/shared/show";
import z from "zod";

const ModelFormSchema = SaveModelBodyRequestSchema;

export type ModelForm = z.infer<typeof ModelFormSchema>;

export const onSubmitModel = (data: ModelForm) => {
	const dataToSend = ModelFormSchema.parse(data);
	return { ...dataToSend, roles: dataToSend.roles.map((role, index) => ({ ...role, order: index + 1 })) };
};
