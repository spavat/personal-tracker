import type { LifespanCategorySaveBodyRequestType } from "@personal-tracker/shared/lifespan";
import type { FastifyBaseLogger } from "fastify";

import type { LifespanCategoryRepository } from "./category.repository";

import { buildLifespanCategory, isOwnDescendant } from "./category.entity";

export class ListLifespanCategoriesUseCase {
	constructor(private repo: LifespanCategoryRepository) {}

	execute(log: FastifyBaseLogger) {
		log.info("ListLifespanCategoriesUseCase.execute");
		return this.repo.findAll();
	}
}

export class SaveLifespanCategoryUseCase {
	constructor(private repo: LifespanCategoryRepository) {}

	async execute(category: LifespanCategorySaveBodyRequestType, log: FastifyBaseLogger) {
		log.info("SaveLifespanCategoryUseCase.execute");
		if (category.id && category.parentId) {
			const categories = (await this.repo.findAll()) ?? [];
			if (isOwnDescendant(category.id, category.parentId, categories as any)) {
				throw new Error("Une catégorie ne peut pas être rangée sous une de ses sous-catégories");
			}
		}
		if (category.id) {
			return this.repo.update(category.id, category);
		}
		return this.repo.insert(buildLifespanCategory(category));
	}
}

export interface DeleteLifespanCategoryResult {
	deleted: boolean;
	reason?: "has_children" | "in_use";
}

export class DeleteLifespanCategoryUseCase {
	constructor(private repo: LifespanCategoryRepository) {}

	async execute(id: string, log: FastifyBaseLogger): Promise<DeleteLifespanCategoryResult> {
		log.info("DeleteLifespanCategoryUseCase.execute");
		const subCategories = await this.repo.findSubCategories(id);
		if (subCategories?.length) {
			return { deleted: false, reason: "has_children" };
		}

		const objects = await this.repo.findObjectsUsingCategory(id);
		if (objects?.length) {
			return { deleted: false, reason: "in_use" };
		}

		await this.repo.delete(id);
		return { deleted: true };
	}
}
