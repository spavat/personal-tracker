import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
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
	@HttpCode(200)
	create(@Body({ schema: CreateBankBodyRequestSchema }) body: CreateBankBody) {
		return this.service.create(body);
	}

	@Post(":id")
	@HttpCode(200)
	update(
		@Param({ schema: BankParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: UpdateBankBodyRequestSchema }) body: UpdateBankBody,
	) {
		return this.service.update(id, body);
	}

	@Delete(":id")
	delete(@Param({ schema: BankParamsRequestSchema }) { id }: { id: number }) {
		return this.service.delete(id);
	}
}
