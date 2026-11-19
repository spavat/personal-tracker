import { WorkSchema, SaveWorkBodyRequestSchema } from "@personal-tracker/shared/show";
import z from "zod";

// the id of the edited record (none: created); the api sends it in the path
const WorkInsideFormSchema = SaveWorkBodyRequestSchema.extend({ id: WorkSchema.shape.id.optional() });

export const WorkFormSchema = z.object({
	work: WorkInsideFormSchema,
});
export type WorkForm = z.infer<typeof WorkFormSchema>;

export const WorkFormSchemaTransformation = WorkInsideFormSchema;

export const onSubmitWork = (data: WorkForm) => {
	return WorkFormSchemaTransformation.parse(data.work);
};
