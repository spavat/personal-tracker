import { Module } from "@nestjs/common";

import { DatabaseModule } from "../../database/database.module.js";
import { PaymentTypesController } from "./payment-types.controller.js";
import { PaymentTypesRepository } from "./payment-types.repository.js";
import { PaymentTypesService } from "./payment-types.service.js";

@Module({
	imports: [DatabaseModule],
	controllers: [PaymentTypesController],
	providers: [PaymentTypesService, PaymentTypesRepository],
})
export class PaymentTypesModule {}
