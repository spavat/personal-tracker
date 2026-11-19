import type { LifespanCategorySaveBodyRequestType } from "@personal-tracker/shared/lifespan";

import { Injectable, Logger } from "@nestjs/common";

import { ConflictError } from "../../common/errors.js";
import { LifespanCategoriesRepository } from "./categories.repository.js";
import { buildLifespanCategory, isOwnDescendant } from "./category.entity.js";

export type DeleteLifespanCategoryResult = { deleted: true } | { deleted: false; reason: "has_children" | "in_use" };

@Injectable()
export class LifespanCategoriesService {
	private readonly logger = new Logger(LifespanCategoriesService.name);
	constructor(private readonly repo: LifespanCategoriesRepository) {}

	list() {
		this.logger.log("list");
		return this.repo.findAll();
	}

	async save(category: LifespanCategorySaveBodyRequestType) {
		this.logger.log("save");
		if (category.id && category.parentId) {
			const categories = await this.repo.findAll();
			if (isOwnDescendant(category.id, category.parentId, categories)) {
				throw new ConflictError("Une catégorie ne peut pas être rangée sous une de ses sous-catégories");
			}
		}
		if (category.id) {
			return this.repo.update(category.id, category);
		}
		return this.repo.insert(buildLifespanCategory(category));
	}

	async delete(id: string): Promise<DeleteLifespanCategoryResult> {
		this.logger.log("delete");
		const subCategories = await this.repo.findSubCategories(id);
		if (subCategories.length) {
			return { deleted: false, reason: "has_children" };
		}

		const objects = await this.repo.findObjectsUsingCategory(id);
		if (objects.length) {
			return { deleted: false, reason: "in_use" };
		}

		await this.repo.delete(id);
		return { deleted: true };
	}
}
