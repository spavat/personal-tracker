import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from "@nestjs/common";
import {
	BankParamsRequestSchema,
	type CreateBankBody,
	CreateBankBodyRequestSchema,
	type UpdateBankBody,
	UpdateBankBodyRequestSchema,
} from "@personal-tracker/shared/money";

import { BanksService } from "./banks.service.js";

@Controller()
export class BanksController {
	constructor(private readonly service: BanksService) {}

	@Get()
	list() {
		return this.service.list();
	}

	@Get("overview")
	overview() {
		return this.service.overview();
	}

	@Get("tree")
	tree() {
		return this.service.tree();
	}

	@Get(":id")
	get(@Param({ schema: BankParamsRequestSchema }) { id }: { id: number }) {
		return this.service.get(id);
	}

	@Post()
	create(@Body({ schema: CreateBankBodyRequestSchema }) body: CreateBankBody) {
		return this.service.create(body);
	}

	@Put(":id")
	update(
		@Param({ schema: BankParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: UpdateBankBodyRequestSchema }) body: UpdateBankBody,
	) {
		return this.service.update(id, body);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: BankParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
