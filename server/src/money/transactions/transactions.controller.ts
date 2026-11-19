import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from "@nestjs/common";
import * as z from "zod";

import type { TransactionBody } from "./transaction.entity.js";

import { type ListTransactionsQuery, TransactionsService } from "./transactions.service.js";

const IdParams = z.object({ id: z.coerce.number() });
const AccountParams = z.object({ accountId: z.coerce.number() });
const CategoryParams = z.object({ categoryId: z.coerce.number() });
const TagParams = z.object({ tagId: z.coerce.number() });

// No shared schema for the transaction body and the list query: passed through unvalidated
@Controller()
export class TransactionsController {
	constructor(private readonly service: TransactionsService) {}

	@Get()
	list(@Query() query: ListTransactionsQuery) {
		return this.service.list(query);
	}

	@Get("account/:accountId")
	listByAccount(@Param({ schema: AccountParams }) { accountId }: { accountId: number }) {
		return this.service.listByAccount(accountId);
	}

	@Get("category/:categoryId")
	listByCategory(@Param({ schema: CategoryParams }) { categoryId }: { categoryId: number }) {
		return this.service.listByCategory(categoryId);
	}

	@Get("tag/:tagId")
	listByTag(@Param({ schema: TagParams }) { tagId }: { tagId: number }) {
		return this.service.listByTag(tagId);
	}

	@Get(":id")
	get(@Param({ schema: IdParams }) { id }: { id: number }) {
		return this.service.get(id);
	}

	@Post()
	create(@Body() body: TransactionBody) {
		return this.service.create(body);
	}

	@Put(":id")
	update(@Param({ schema: IdParams }) { id }: { id: number }, @Body() body: TransactionBody) {
		return this.service.update(id, body);
	}

	@Patch(":id")
	patch(@Param({ schema: IdParams }) { id }: { id: number }, @Body() body: TransactionBody) {
		return this.service.patch(id, body);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: IdParams }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
