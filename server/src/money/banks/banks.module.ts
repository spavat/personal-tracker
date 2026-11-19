import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module.js";
import { TransactionsModule } from "../transactions/transactions.module.js";
import { BanksController } from "./banks.controller.js";
import { BanksRepository } from "./banks.repository.js";
import { BanksService } from "./banks.service.js";

@Module({
	// TransactionsModule exports TransactionsRepository, used by the overview
	imports: [DatabaseModule, TransactionsModule],
	controllers: [BanksController],
	providers: [BanksService, BanksRepository],
})
export class BanksModule {}
