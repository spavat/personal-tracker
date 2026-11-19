import { SpectacleSchema, SaveSpectacleBodyRequestSchema } from "@personal-tracker/shared/show";
import z from "zod";

// the id of the edited record (none: created); the api sends it in the path
const SpectacleInsideFormSchema = SaveSpectacleBodyRequestSchema.extend({ id: SpectacleSchema.shape.id.optional() });

const SpectacleFormSchema = z.object({
	spectacle: SpectacleInsideFormSchema,
});
export type SpectacleForm = z.infer<typeof SpectacleFormSchema>;
