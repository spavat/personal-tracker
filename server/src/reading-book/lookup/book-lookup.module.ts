import { Module } from "@nestjs/common";

import { EntitiesModule } from "../../entities/entities.module.js";
import { BookLookupController } from "./book-lookup.controller.js";
import { BookLookupService } from "./book-lookup.service.js";
import { bookSourcesProvider } from "./book-source.provider.js";

@Module({
	// EntitiesModule exports its repository: the people and publishers found are matched to the entities
	imports: [EntitiesModule],
	controllers: [BookLookupController],
	providers: [BookLookupService, bookSourcesProvider],
})
export class BookLookupModule {}
