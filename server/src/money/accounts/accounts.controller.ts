import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, SerializeOptions } from "@nestjs/common";
import {
	AccountDetailsSchema,
	AccountParamsRequestSchema,
	AccountSchema,
	type CreateAccountBody,
	CreateAccountBodyRequestSchema,
	type UpdateAccountBody,
	UpdateAccountBodyRequestSchema,
} from "@personal-tracker/shared/money";

import { AccountsService } from "./accounts.service.js";

@Controller()
export class AccountsController {
	constructor(private readonly service: AccountsService) {}

	@Get()
	@SerializeOptions({ schema: AccountSchema })
	list() {
		return this.service.list();
	}

	@Get(":id")
	@SerializeOptions({ schema: AccountSchema })
	get(@Param({ schema: AccountParamsRequestSchema }) { id }: { id: number }) {
		return this.service.get(id);
	}

	@Get(":id/details")
	@SerializeOptions({ schema: AccountDetailsSchema })
	getDetails(@Param({ schema: AccountParamsRequestSchema }) { id }: { id: number }) {
		return this.service.getDetails(id);
	}

	@Post()
	@SerializeOptions({ schema: AccountSchema })
	create(@Body({ schema: CreateAccountBodyRequestSchema }) body: CreateAccountBody) {
		return this.service.create(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: AccountSchema })
	update(
		@Param({ schema: AccountParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: UpdateAccountBodyRequestSchema }) body: UpdateAccountBody,
	) {
		return this.service.update(id, body);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: AccountParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
