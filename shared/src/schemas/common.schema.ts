import * as z from "zod";

export const SortQSSchema = z.object({
	sort: z.array(z.string()).optional(),
});
export const SearchQSSchema = z.object({
	search: z.string().optional(),
});
export const OptionalPeriodQSSchema = z.object({
	from: z.iso.date().optional(),
	to: z.iso.date().optional(),
});
export const PeriodQSSchema = z.object({
	from: z.iso.date(),
	to: z.iso.date(),
});

export const GenericListSchema = SortQSSchema.extend(SearchQSSchema.shape).extend(OptionalPeriodQSSchema.shape);

export const UUIDParamsSchema = z.object({
	id: z.uuid(),
});

export const NumberIdParamsSchema = z.object({
	id: z.coerce.number(),
});
