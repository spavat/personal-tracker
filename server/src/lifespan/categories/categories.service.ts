import type { LifespanCategorySaveBodyRequestType } from "@personal-tracker/shared/lifespan";

import { Injectable, Logger } from "@nestjs/common";

import { ConflictError, NotFoundError } from "../../common/errors.js";
import { LifespanCategoriesRepository } from "./categories.repository.js";
import { buildLifespanCategory, isOwnDescendant } from "./category.entity.js";

@Injectable()
export class LifespanCategoriesService {
	private readonly logger = new Logger(LifespanCategoriesService.name);
	constructor(private readonly repo: LifespanCategoriesRepository) {}

	list() {
		this.logger.log("list");
		return this.repo.findAll();
	}

	create(category: LifespanCategorySaveBodyRequestType) {
		this.logger.log("create");
		return this.repo.insert(buildLifespanCategory(category));
	}

	async update(id: string, category: LifespanCategorySaveBodyRequestType) {
		this.logger.log("update");
		if (category.parentId) {
			const categories = await this.repo.findAll();
			if (isOwnDescendant(id, category.parentId, categories)) {
				throw new ConflictError("cycle", "a category can't be under one of its descendants", {
					resource: "lifespan_category",
				});
			}
		}
		return (await this.repo.update(id, category)) ?? notFound();
	}

	async delete(id: string) {
		this.logger.log("delete");
		const subCategories = await this.repo.findSubCategories(id);
		if (subCategories.length) {
			throw new ConflictError("has_dependents", "the category has sub-categories", {
				resource: "lifespan_category",
				dependent: "children",
			});
		}

		const objects = await this.repo.findObjectsUsingCategory(id);
		if (objects.length) {
			throw new ConflictError("has_dependents", "the category has objects", {
				resource: "lifespan_category",
				dependent: "objects",
			});
		}

		if (!(await this.repo.delete(id))) {
			notFound();
		}
	}
}

function notFound(): never {
	throw new NotFoundError("category");
}
