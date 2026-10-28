import type { CreateCategoryBody, UpdateCategoryBody } from "@personal-tracker/shared/money";
import type { FastifyBaseLogger } from "fastify";

import type { CategoryRepository } from "./category.repository";

export class ListCategoriesUseCase {
	constructor(private repo: CategoryRepository) {}

	execute(log: FastifyBaseLogger) {
		log.info("ListCategoriesUseCase.execute");
		return this.repo.findAll();
	}
}

export class GetCategoryUseCase {
	constructor(private repo: CategoryRepository) {}

	async execute(id: number, log: FastifyBaseLogger) {
		log.info("GetCategoryUseCase.execute");
		const categorie = await this.repo.findById(id);
		if (!categorie) return null;
		const transactions = await this.repo.findTransactionsUsingCategory(id);
		return { ...categorie, transactions: transactions.length };
	}
}

export class CreateCategoryUseCase {
	constructor(private repo: CategoryRepository) {}

	execute(data: CreateCategoryBody, log: FastifyBaseLogger) {
		log.info("CreateCategoryUseCase.execute");
		return this.repo.create(data);
	}
}

export class UpdateCategoryUseCase {
	constructor(private repo: CategoryRepository) {}

	execute({ id, data }: { id: number; data: UpdateCategoryBody }, log: FastifyBaseLogger) {
		log.info("UpdateCategoryUseCase.execute");
		return this.repo.update(id, data);
	}
}

export class DeleteCategoryUseCase {
	constructor(private repo: CategoryRepository) {}

	async execute(id: number, log: FastifyBaseLogger): Promise<boolean> {
		log.info("DeleteCategoryUseCase.execute");
		const subCategories = await this.repo.findSubCategories(id);
		if (subCategories.length) {
			console.log("subcategorie exists", subCategories);
			return false;
		}

		const transactions = await this.repo.findTransactionsUsingCategory(id);
		if (transactions.length) {
			console.log("transactions are still using this categorie", transactions.length);
			return false;
		}

		const deleted = await this.repo.destroy(id);
		if (!deleted) {
			console.log("Impossible de trouver la catégorie", id);
			return false;
		}

		return true;
	}
}
