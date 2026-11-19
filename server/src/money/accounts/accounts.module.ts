import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module.js";
import { AccountsController } from "./accounts.controller.js";
import { AccountsRepository } from "./accounts.repository.js";
import { AccountsService } from "./accounts.service.js";

@Module({
	imports: [DatabaseModule],
	controllers: [AccountsController],
	providers: [AccountsService, AccountsRepository],
})
export class AccountsModule {}
