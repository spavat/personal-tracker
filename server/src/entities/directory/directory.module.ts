import { Module } from "@nestjs/common";

import { BroadcastSharedModule } from "../../broadcast/broadcast-shared.module.js";
import { ReadingBookModule } from "../../reading-book/reading-book.module.js";
import { ShowSharedModule } from "../../show/show-shared.module.js";
import { EntitiesModule } from "../entities.module.js";
import { DirectoryController } from "./directory.controller.js";
import { DirectoryService } from "./directory.service.js";

// Reads the credits of every module through the repository each one exports. Imported by AppModule, not by
// EntitiesModule: ReadingBookModule already imports EntitiesModule (through its lookup), that would be a cycle.
@Module({
	imports: [EntitiesModule, ShowSharedModule, ReadingBookModule, BroadcastSharedModule],
	controllers: [DirectoryController],
	providers: [DirectoryService],
})
export class DirectoryModule {}
