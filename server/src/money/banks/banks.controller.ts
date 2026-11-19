import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, SerializeOptions } from "@nestjs/common";
import {
	BankOverviewSchema,
	BankParamsRequestSchema,
	BankSchema,
	BankTreeSchema,
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
	@SerializeOptions({ schema: BankSchema })
	list() {
		return this.service.list();
	}

	@Get("overview")
	@SerializeOptions({ schema: BankOverviewSchema })
	overview() {
		return this.service.overview();
	}

	@Get("tree")
	@SerializeOptions({ schema: BankTreeSchema })
	tree() {
		return this.service.tree();
	}

	@Get(":id")
	@SerializeOptions({ schema: BankTreeSchema })
	get(@Param({ schema: BankParamsRequestSchema }) { id }: { id: number }) {
		return this.service.get(id);
	}

	@Post()
	@SerializeOptions({ schema: BankSchema })
	create(@Body({ schema: CreateBankBodyRequestSchema }) body: CreateBankBody) {
		return this.service.create(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: BankSchema })
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
