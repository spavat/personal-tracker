import { SaveWorkBodyRequestSchema } from "@personal-tracker/shared/show";
import z from "zod";

const WorkInsideFormSchema = SaveWorkBodyRequestSchema;

export const WorkFormSchema = z.object({
	work: WorkInsideFormSchema,
});
export type WorkForm = z.infer<typeof WorkFormSchema>;

export const WorkFormSchemaTransformation = WorkInsideFormSchema;

export const onSubmitWork = (data: WorkForm) => {
	return WorkFormSchemaTransformation.parse(data.work);
};
