import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, SerializeOptions } from "@nestjs/common";
import {
	type CreatePaymentTypeBody,
	CreatePaymentTypeBodyRequestSchema,
	PaymentTypeDetailsSchema,
	PaymentTypeParamsRequestSchema,
	PaymentTypeSchema,
	type UpdatePaymentTypeBody,
	UpdatePaymentTypeBodyRequestSchema,
} from "@personal-tracker/shared/money";

import { PaymentTypesService } from "./payment-types.service.js";

@Controller()
export class PaymentTypesController {
	constructor(private readonly service: PaymentTypesService) {}

	@Get()
	@SerializeOptions({ schema: PaymentTypeSchema })
	list() {
		return this.service.list();
	}

	@Get(":id")
	@SerializeOptions({ schema: PaymentTypeSchema })
	get(@Param({ schema: PaymentTypeParamsRequestSchema }) { id }: { id: number }) {
		return this.service.get(id);
	}

	@Get(":id/details")
	@SerializeOptions({ schema: PaymentTypeDetailsSchema })
	getDetails(@Param({ schema: PaymentTypeParamsRequestSchema }) { id }: { id: number }) {
		return this.service.getDetails(id);
	}

	@Post()
	@SerializeOptions({ schema: PaymentTypeSchema })
	create(@Body({ schema: CreatePaymentTypeBodyRequestSchema }) body: CreatePaymentTypeBody) {
		return this.service.create(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: PaymentTypeSchema })
	update(
		@Param({ schema: PaymentTypeParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: UpdatePaymentTypeBodyRequestSchema }) body: UpdatePaymentTypeBody,
	) {
		return this.service.update(id, body);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: PaymentTypeParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
