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

	create({ id: _, ...category }: LifespanCategorySaveBodyRequestType) {
		this.logger.log("create");
		return this.repo.insert(buildLifespanCategory(category));
	}

	async update(id: string, { id: _, ...category }: LifespanCategorySaveBodyRequestType) {
		this.logger.log("update");
		if (category.parentId) {
			const categories = await this.repo.findAll();
			if (isOwnDescendant(id, category.parentId, categories)) {
				throw new ConflictError("Une catégorie ne peut pas être rangée sous une de ses sous-catégories");
			}
		}
		return (await this.repo.update(id, category)) ?? notFound();
	}

	async delete(id: string) {
		this.logger.log("delete");
		const subCategories = await this.repo.findSubCategories(id);
		if (subCategories.length) {
			throw new ConflictError(
				"Cette catégorie a des sous-catégories. Supprimez-les ou déplacez-les avant de continuer.",
			);
		}

		const objects = await this.repo.findObjectsUsingCategory(id);
		if (objects.length) {
			throw new ConflictError(
				"Des objets sont encore rattachés à cette catégorie. Déplacez-les avant de continuer.",
			);
		}

		if (!(await this.repo.delete(id))) {
			notFound();
		}
	}
}

function notFound(): never {
	throw new NotFoundError("Catégorie introuvable");
}
