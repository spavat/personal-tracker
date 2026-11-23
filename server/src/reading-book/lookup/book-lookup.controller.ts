import { Controller, Get, Param, Query, SerializeOptions } from "@nestjs/common";
import {
	LookupEditionListSchema,
	LookupEditionQuerySchema,
	LookupEditionSchema,
	type LookupSource,
	LookupSourceParamsSchema,
	LookupWorkEditionsQuerySchema,
	LookupWorkListSchema,
	LookupWorkParamsSchema,
	type LookupWorksQuery,
	LookupWorksQuerySchema,
} from "@personal-tracker/shared/reading-book";

import { BookLookupService } from "./book-lookup.service.js";

// Read-only searches in an outside source (Open Library…) to fill in the book and edition forms.
// Mounted at /reading-book/lookup by ReadingBookModule's RouterModule children
@Controller(":source")
export class BookLookupController {
	constructor(private readonly service: BookLookupService) {}

	@Get("works")
	@SerializeOptions({ schema: LookupWorkListSchema.element })
	searchWorks(
		@Param({ schema: LookupSourceParamsSchema }) { source }: { source: LookupSource },
		@Query({ schema: LookupWorksQuerySchema }) query: LookupWorksQuery,
	) {
		return this.service.searchWorks(source, query);
	}

	@Get("works/:externalId/editions")
	@SerializeOptions({ schema: LookupEditionListSchema.element })
	workEditions(
		@Param({ schema: LookupWorkParamsSchema }) { source, externalId }: { source: LookupSource; externalId: string },
		@Query({ schema: LookupWorkEditionsQuerySchema }) { language }: { language?: string },
	) {
		return this.service.workEditions(source, externalId, language);
	}

	@Get("editions")
	@SerializeOptions({ schema: LookupEditionSchema })
	editionByIsbn(
		@Param({ schema: LookupSourceParamsSchema }) { source }: { source: LookupSource },
		@Query({ schema: LookupEditionQuerySchema }) { isbn }: { isbn: string },
	) {
		return this.service.editionByIsbn(source, isbn);
	}
}
