import type { CreateAccountBody, UpdateAccountBody } from "@personal-tracker/shared/money";
import type { FastifyBaseLogger } from "fastify";

import type { AccountRepository } from "./account.repository";

export class ListAccountsUseCase {
	constructor(private repo: AccountRepository) {}

	execute(log: FastifyBaseLogger) {
		log.info("ListAccountsUseCase.execute");
		return this.repo.findAll();
	}
}

export class GetAccountUseCase {
	constructor(private repo: AccountRepository) {}

	execute(id: number, log: FastifyBaseLogger) {
		log.info("GetAccountUseCase.execute");
		return this.repo.findById(id);
	}
}

export class GetAccountDetailsUseCase {
	constructor(private repo: AccountRepository) {}

	execute(id: number, log: FastifyBaseLogger) {
		log.info("GetAccountDetailsUseCase.execute");
		return this.repo.findByIdWithDetails(id);
	}
}

export class CreateAccountUseCase {
	constructor(private repo: AccountRepository) {}

	execute(data: CreateAccountBody, log: FastifyBaseLogger) {
		log.info("CreateAccountUseCase.execute");
		return this.repo.create(data);
	}
}

export class UpdateAccountUseCase {
	constructor(private repo: AccountRepository) {}

	execute({ id, data }: { id: number; data: UpdateAccountBody }, log: FastifyBaseLogger) {
		log.info("UpdateAccountUseCase.execute");
		return this.repo.update(id, data);
	}
}

export class DeleteAccountUseCase {
	constructor(private repo: AccountRepository) {}

	async execute(id: number, log: FastifyBaseLogger) {
		log.info("DeleteAccountUseCase.execute");
		const accountToDelete = await this.repo.findByIdWithRelationsForDelete(id);
		if (!accountToDelete) {
			throw new Error(`Compte (${id}) non trouvé`);
		}

		const history = accountToDelete.history ?? [];
		if (history.length) {
			throw new Error(`Le compte (${id}) possède un historique (${history.length})`);
		}

		const paymentTypes = accountToDelete.paymentTypes ?? [];
		if (paymentTypes.length) {
			throw new Error(`Le compte (${id}) possède des moyens de payments (${paymentTypes.length})`);
		}

		return this.repo.destroy(accountToDelete);
	}
}
