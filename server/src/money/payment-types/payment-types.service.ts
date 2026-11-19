import type { CreatePaymentTypeBody, UpdatePaymentTypeBody } from "@personal-tracker/shared/money";

import { Injectable, Logger } from "@nestjs/common";

import { ConflictError, NotFoundError } from "../../common/errors.js";
import { PaymentTypesRepository } from "./payment-types.repository.js";

@Injectable()
export class PaymentTypesService {
	private readonly logger = new Logger(PaymentTypesService.name);
	constructor(private readonly repo: PaymentTypesRepository) {}

	list() {
		this.logger.log("list");
		return this.repo.findAll();
	}

	async get(id: number) {
		this.logger.log("get");
		return (await this.repo.findById(id)) ?? notFound();
	}

	async getDetails(id: number) {
		this.logger.log("getDetails");
		return (await this.repo.findByIdWithTransactions(id)) ?? notFound();
	}

	create(data: CreatePaymentTypeBody) {
		this.logger.log("create");
		return this.repo.create(data);
	}

	async update(id: number, data: UpdatePaymentTypeBody) {
		this.logger.log("update");
		return (await this.repo.update(id, data)) ?? notFound();
	}

	async delete(id: number) {
		this.logger.log("delete");
		if (!(await this.repo.findById(id))) {
			notFound();
		}
		const transactions = await this.repo.findTransactionsUsingPaymentType(id);
		if (transactions.length) {
			throw new ConflictError("has_dependents", "the payment type has transactions", {
				resource: "payment_type",
				dependent: "transactions",
				count: transactions.length,
			});
		}
		await this.repo.destroy(id);
	}
}

function notFound(): never {
	throw new NotFoundError("payment_type");
}
