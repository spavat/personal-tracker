import { SaveSpectacleBodyRequestSchema } from "@personal-tracker/shared/show";
import z from "zod";

const SpectacleInsideFormSchema = SaveSpectacleBodyRequestSchema;

const SpectacleFormSchema = z.object({
	spectacle: SpectacleInsideFormSchema,
});
export type SpectacleForm = z.infer<typeof SpectacleFormSchema>;
