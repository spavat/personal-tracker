import { Injectable, Logger } from "@nestjs/common";
import { CreateCategoryBody, UpdateCategoryBody } from "@personal-tracker/shared/money";

import { ConflictError, NotFoundError } from "../../common/errors.js";
import { CategoriesRepository } from "./categories.repository.js";

@Injectable()
export class CategoriesService {
	private readonly logger = new Logger(CategoriesService.name);
	constructor(private readonly repo: CategoriesRepository) {}

	list() {
		this.logger.log("list");
		return this.repo.findAll();
	}

	async getCategory(id: number) {
		this.logger.log("getCategory");
		const categorie = await this.repo.findById(id);
		if (!categorie) {
			throw new NotFoundError("Catégorie introuvable");
		}
		const transactions = await this.repo.findTransactionsUsingCategory(id);
		return { ...categorie, transactions: transactions.length };
	}

	create(data: CreateCategoryBody) {
		this.logger.log("create");
		return this.repo.create(data);
	}

	async update(id: number, data: UpdateCategoryBody) {
		this.logger.log("update");
		const result = await this.repo.update(id, data);
		if (!result) {
			throw new NotFoundError("Catégorie introuvable");
		}
		return result;
	}

	async delete(id: number): Promise<{ deleted: boolean }> {
		this.logger.log("delete");
		const subCategories = await this.repo.findSubCategories(id);
		if (subCategories.length) {
			throw new ConflictError("La catégorie a des sous-catégories : impossible de la supprimer");
		}

		const transactions = await this.repo.findTransactionsUsingCategory(id);
		if (transactions.length) {
			throw new ConflictError("La catégorie a des transactions : impossible de la supprimer");
		}

		const deleted = await this.repo.destroy(id);
		if (!deleted) {
			throw new NotFoundError("Catégorie introuvable");
		}

		return { deleted: true };
	}
}
