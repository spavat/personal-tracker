import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import {
	type CreatePaymentTypeBody,
	CreatePaymentTypeBodyRequestSchema,
	PaymentTypeParamsRequestSchema,
	type UpdatePaymentTypeBody,
	UpdatePaymentTypeBodyRequestSchema,
} from "@personal-tracker/shared/money";

import { PaymentTypesService } from "./payment-types.service.js";

@Controller()
export class PaymentTypesController {
	constructor(private readonly service: PaymentTypesService) {}

	@Get()
	list() {
		return this.service.list();
	}

	@Get(":id")
	get(@Param({ schema: PaymentTypeParamsRequestSchema }) { id }: { id: number }) {
		return this.service.get(id);
	}

	@Get(":id/details")
	getDetails(@Param({ schema: PaymentTypeParamsRequestSchema }) { id }: { id: number }) {
		return this.service.getDetails(id);
	}

	@Post()
	@HttpCode(200)
	create(@Body({ schema: CreatePaymentTypeBodyRequestSchema }) body: CreatePaymentTypeBody) {
		return this.service.create(body);
	}

	@Post(":id")
	@HttpCode(200)
	update(
		@Param({ schema: PaymentTypeParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: UpdatePaymentTypeBodyRequestSchema }) body: UpdatePaymentTypeBody,
	) {
		return this.service.update(id, body);
	}

	@Delete(":id")
	delete(@Param({ schema: PaymentTypeParamsRequestSchema }) { id }: { id: number }) {
		return this.service.delete(id);
	}
}
