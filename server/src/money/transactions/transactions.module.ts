import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module.js";
import { TransactionsController } from "./transactions.controller.js";
import { TransactionsRepository } from "./transactions.repository.js";
import { TransactionsService } from "./transactions.service.js";

@Module({
	imports: [DatabaseModule],
	controllers: [TransactionsController],
	providers: [TransactionsService, TransactionsRepository],
	// read by the banks overview and the money recap
	exports: [TransactionsRepository],
})
export class TransactionsModule {}
