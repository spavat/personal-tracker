import type { CreateAccountBody, UpdateAccountBody } from "@personal-tracker/shared/money";

import { Injectable, Logger } from "@nestjs/common";

import { ConflictError, NotFoundError } from "../../common/errors.js";
import { AccountsRepository } from "./accounts.repository.js";

@Injectable()
export class AccountsService {
	private readonly logger = new Logger(AccountsService.name);
	constructor(private readonly repo: AccountsRepository) {}

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
		return (await this.repo.findByIdWithDetails(id)) ?? notFound();
	}

	create(data: CreateAccountBody) {
		this.logger.log("create");
		return this.repo.create(data);
	}

	async update(id: number, data: UpdateAccountBody) {
		this.logger.log("update");
		return (await this.repo.update(id, data)) ?? notFound();
	}

	async delete(id: number) {
		this.logger.log("delete");
		const account = (await this.repo.findByIdWithRelationsForDelete(id)) ?? notFound();
		if (account.history.length) {
			throw new ConflictError(`Le compte a un historique (${account.history.length})`);
		}
		if (account.paymentTypes.length) {
			throw new ConflictError(`Le compte a des moyens de paiement (${account.paymentTypes.length})`);
		}
		await this.repo.destroy(id);
	}
}

function notFound(): never {
	throw new NotFoundError("Compte introuvable");
}
