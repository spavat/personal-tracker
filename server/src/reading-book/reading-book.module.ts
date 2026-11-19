import { Module } from "@nestjs/common";

import { ContextTagsModule } from "../context-tags/context-tags.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { StorageModule } from "../storage/storage.module.js";
import { BookRepository } from "./book.repository.js";
import { CoverStorage } from "./cover.storage.js";
import { ReadingBookController } from "./reading-book.controller.js";
import { ReadingBookService } from "./reading-book.service.js";

@Module({
	// ContextTagsModule exports its repository: the report groups the chapter tags by tag group
	imports: [DatabaseModule, StorageModule, ContextTagsModule],
	controllers: [ReadingBookController],
	providers: [ReadingBookService, BookRepository, CoverStorage],
	// read by the images proxy (the cover key)
	exports: [BookRepository],
})
export class ReadingBookModule {}
