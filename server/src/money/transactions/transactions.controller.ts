import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Patch,
	Post,
	Put,
	Query,
	SerializeOptions,
} from "@nestjs/common";
import {
	TransactionAccountParamsRequestSchema,
	TransactionCategoryParamsRequestSchema,
	type TransactionListQuerystring,
	TransactionListQuerystringRequestSchema,
	TransactionParamsRequestSchema,
	type TransactionPatchBody,
	TransactionPatchBodyRequestSchema,
	type TransactionSaveBody,
	TransactionSaveBodyRequestSchema,
	TransactionSchema,
	TransactionTagParamsRequestSchema,
} from "@personal-tracker/shared/money";

import { TransactionsService } from "./transactions.service.js";

@Controller()
export class TransactionsController {
	constructor(private readonly service: TransactionsService) {}

	@Get()
	@SerializeOptions({ schema: TransactionSchema })
	list(@Query({ schema: TransactionListQuerystringRequestSchema }) query: TransactionListQuerystring) {
		return this.service.list(query);
	}

	@Get("account/:accountId")
	@SerializeOptions({ schema: TransactionSchema })
	listByAccount(@Param({ schema: TransactionAccountParamsRequestSchema }) { accountId }: { accountId: number }) {
		return this.service.listByAccount(accountId);
	}

	@Get("category/:categoryId")
	@SerializeOptions({ schema: TransactionSchema })
	listByCategory(@Param({ schema: TransactionCategoryParamsRequestSchema }) { categoryId }: { categoryId: number }) {
		return this.service.listByCategory(categoryId);
	}

	@Get("tag/:tagId")
	@SerializeOptions({ schema: TransactionSchema })
	listByTag(@Param({ schema: TransactionTagParamsRequestSchema }) { tagId }: { tagId: number }) {
		return this.service.listByTag(tagId);
	}

	@Get(":id")
	@SerializeOptions({ schema: TransactionSchema })
	get(@Param({ schema: TransactionParamsRequestSchema }) { id }: { id: number }) {
		return this.service.get(id);
	}

	@Post()
	@SerializeOptions({ schema: TransactionSchema })
	create(@Body({ schema: TransactionSaveBodyRequestSchema }) body: TransactionSaveBody) {
		return this.service.create(body);
	}

	@Put(":id")
	@SerializeOptions({ schema: TransactionSchema })
	update(
		@Param({ schema: TransactionParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: TransactionSaveBodyRequestSchema }) body: TransactionSaveBody,
	) {
		return this.service.update(id, body);
	}

	@Patch(":id")
	@SerializeOptions({ schema: TransactionSchema })
	patch(
		@Param({ schema: TransactionParamsRequestSchema }) { id }: { id: number },
		@Body({ schema: TransactionPatchBodyRequestSchema }) body: TransactionPatchBody,
	) {
		return this.service.patch(id, body);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: TransactionParamsRequestSchema }) { id }: { id: number }) {
		await this.service.delete(id);
	}
}
