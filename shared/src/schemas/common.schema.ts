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

// A node's id in each outside source it was found in (core.external_id, see .scratch/reading-book-openlibrary/spec.md)
export const ExternalSourceSchema = z.enum(["openLibrary"]);
export type ExternalSource = z.infer<typeof ExternalSourceSchema>;
export const ExternalIdsSchema = z.object({ openLibrary: z.string().trim().nonempty() }).partial();
export type ExternalIds = z.infer<typeof ExternalIdsSchema>;

// ISO 639-1, lowercase: "fr", "en", "ja"
export const LanguageCodeSchema = z.string().regex(/^[a-z]{2}$/);
// ISO 3166-1 alpha-2, lowercase: the flag-icons class suffix ("fi fi-fr")
export const CountryCodeSchema = z.string().regex(/^[a-z]{2}$/);
