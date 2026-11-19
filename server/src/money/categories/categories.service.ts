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
			throw new NotFoundError("category");
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
			throw new NotFoundError("category");
		}
		return result;
	}

	async delete(id: number) {
		this.logger.log("delete");
		const subCategories = await this.repo.findSubCategories(id);
		if (subCategories.length) {
			throw new ConflictError("has_dependents", "the category has sub-categories", {
				resource: "category",
				dependent: "children",
			});
		}

		const transactions = await this.repo.findTransactionsUsingCategory(id);
		if (transactions.length) {
			throw new ConflictError("has_dependents", "the category has transactions", {
				resource: "category",
				dependent: "transactions",
			});
		}

		const deleted = await this.repo.destroy(id);
		if (!deleted) {
			throw new NotFoundError("category");
		}
	}
}
