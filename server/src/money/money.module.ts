import { Module } from "@nestjs/common";
import { RouterModule } from "@nestjs/core";

import { AccountsModule } from "./accounts/accounts.module.js";
import { BanksModule } from "./banks/banks.module.js";
import { CategoriesModule } from "./categories/categories.module.js";
import { PaymentTypesModule } from "./payment-types/payment-types.module.js";
import { RecapController } from "./recap.controller.js";
import { RecapService } from "./recap.service.js";
import { TagsModule } from "./tags/tags.module.js";
import { TransactionsModule } from "./transactions/transactions.module.js";

@Module({
	imports: [
		AccountsModule,
		BanksModule,
		CategoriesModule,
		PaymentTypesModule,
		TagsModule,
		TransactionsModule,
		RouterModule.register([
			{
				path: "money",
				module: MoneyModule,
				children: [
					{ path: "accounts", module: AccountsModule },
					{ path: "banks", module: BanksModule },
					{ path: "categories", module: CategoriesModule },
					{ path: "payment-types", module: PaymentTypesModule },
					{ path: "tags", module: TagsModule },
					{ path: "transactions", module: TransactionsModule },
				],
			},
		]),
	],
	// the recap reads CategoriesModule's and TransactionsModule's exported repositories
	controllers: [RecapController],
	providers: [RecapService],
})
export class MoneyModule {}
