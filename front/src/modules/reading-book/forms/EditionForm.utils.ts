import type { Edition, EditionType, SaveEditionRequest } from "@personal-tracker/shared/reading-book";

export type EditionFormData = {
	title: string;
	// an organization
	publisherId: string;
	translators: Array<{ entityId: string; creditedAs: string }>;
	language: string;
	pages: string;
	type: EditionType | "";
	isbn: string;
	year: string;
	// the server's URL (unchanged), an image URL or a data URI (new), empty (no cover)
	cover: string;
	modelId: string;
};

// a new edition gets the book's first model
export function toEditionFormData(edition?: Edition, defaultModelId?: string): EditionFormData {
	return {
		title: edition?.title ?? "",
		publisherId: edition?.publisher?.id ?? "",
		translators:
			edition?.translators.map(({ entityId, creditedAs }) => ({ entityId, creditedAs: creditedAs ?? "" })) ?? [],
		language: edition?.language ?? "",
		pages: edition?.pages?.toString() ?? "",
		type: edition?.type ?? "",
		isbn: edition?.isbn ?? "",
		year: edition?.year?.toString() ?? "",
		cover: edition?.cover ?? "",
		modelId: (edition ? edition.modelId : defaultModelId) ?? "",
	};
}

const textOrNull = (value: string) => value.trim() || null;
const numberOrNull = (value: string) => (value.trim() ? Number(value) : null);

export function toSaveEdition(data: EditionFormData, id?: string): SaveEditionRequest {
	return {
		id,
		title: textOrNull(data.title),
		publisherId: data.publisherId || null,
		// a row left without person is dropped
		translators: data.translators
			.filter(({ entityId }) => entityId)
			.map(({ entityId, creditedAs }) => ({ entityId, creditedAs: textOrNull(creditedAs) })),
		language: textOrNull(data.language),
		pages: numberOrNull(data.pages),
		type: data.type || null,
		isbn: textOrNull(data.isbn),
		year: numberOrNull(data.year),
		cover: textOrNull(data.cover),
		modelId: data.modelId || null,
	};
}
