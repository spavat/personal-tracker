import { SavePerformanceBodyRequestSchema } from "@personal-tracker/shared/show";
import z from "zod";

const PlaceInsideFormSchema = SavePerformanceBodyRequestSchema;

const PerformanceFormSchema = z.object({
	performance: SavePerformanceBodyRequestSchema.shape.performance,
});
export type PerformanceForm = z.infer<typeof PerformanceFormSchema>;

const PerformanceFormSchemaTransformation = PlaceInsideFormSchema;

export const onSubmitPerformance = (data: PerformanceForm) => PerformanceFormSchemaTransformation.parse(data);
