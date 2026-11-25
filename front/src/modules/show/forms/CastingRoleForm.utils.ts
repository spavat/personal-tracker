import { RoleSchema, SaveCastingBodyRequestSchema } from "@personal-tracker/shared/show";
import z from "zod";

// the performance's id: the api sends it in the path
const CastingFormSchema = SaveCastingBodyRequestSchema.extend({
	performanceId: z.uuid(),
	roles: z.array(RoleSchema.partial({ id: true, status: true })),
});

export type CastingForm = z.infer<typeof CastingFormSchema>;

export const onSubmitCasting = (data: CastingForm) => {
	const dataToSend = CastingFormSchema.parse(data);
	return { ...dataToSend, roles: dataToSend.roles.map((role, index) => ({ ...role, order: index + 1 })) };
};
