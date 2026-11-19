import type { CreatePaymentTypeBody, UpdatePaymentTypeBody } from "@personal-tracker/shared/money";
import type { FastifyBaseLogger } from "fastify";

import type { PaymentTypeRepository } from "./paymentType.repository";

export class ListPaymentTypesUseCase {
	constructor(private repo: PaymentTypeRepository) {}

	execute(log: FastifyBaseLogger) {
		log.info("ListPaymentTypesUseCase.execute");
		return this.repo.findAll();
	}
}

export class GetPaymentTypeUseCase {
	constructor(private repo: PaymentTypeRepository) {}

	execute(id: number, log: FastifyBaseLogger) {
		log.info("GetPaymentTypeUseCase.execute");
		return this.repo.findById(id);
	}
}

export class GetPaymentTypeDetailsUseCase {
	constructor(private repo: PaymentTypeRepository) {}

	execute(id: number, log: FastifyBaseLogger) {
		log.info("GetPaymentTypeDetailsUseCase.execute");
		return this.repo.findByIdWithTransactions(id);
	}
}

export class CreatePaymentTypeUseCase {
	constructor(private repo: PaymentTypeRepository) {}

	execute(data: CreatePaymentTypeBody, log: FastifyBaseLogger) {
		log.info("CreatePaymentTypeUseCase.execute");
		return this.repo.create(data);
	}
}

export class UpdatePaymentTypeUseCase {
	constructor(private repo: PaymentTypeRepository) {}

	execute({ id, data }: { id: number; data: UpdatePaymentTypeBody }, log: FastifyBaseLogger) {
		log.info("UpdatePaymentTypeUseCase.execute");
		return this.repo.update(id, data);
	}
}

export class DeletePaymentTypeUseCase {
	constructor(private repo: PaymentTypeRepository) {}

	async execute(id: number, log: FastifyBaseLogger) {
		log.info("DeletePaymentTypeUseCase.execute");
		const paymentTypeToDelete = await this.repo.findById(id);
		if (!paymentTypeToDelete) {
			throw new Error(`Type de paiement (${id}) non trouvé`);
		}

		// Check if use
		const transactions = await this.repo.findTransactionsUsingPaymentType(id);
		if (transactions.length) {
			throw new Error(`transactions are still using this payment type ${transactions.length}`);
		}

		return this.repo.destroy(paymentTypeToDelete);
	}
}
