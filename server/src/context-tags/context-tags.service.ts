import { Injectable, Logger } from "@nestjs/common";
import { SaveContextTagBody } from "@personal-tracker/shared/context-tag";

import { NotFoundError } from "../common/errors.js";
import { buildContextTag } from "./context-tag.entity.js";
import { ContextTagsRepository } from "./context-tags.repository.js";

@Injectable()
export class ContextTagsService {
	private readonly logger = new Logger(ContextTagsService.name);
	constructor(private readonly repo: ContextTagsRepository) {}

	list() {
		this.logger.log("list");
		return this.repo.findAll();
	}

	create({ id: _, ...fields }: SaveContextTagBody) {
		this.logger.log("create");
		return this.repo.insert(buildContextTag(fields));
	}

	async update(id: string, { id: _, ...fields }: SaveContextTagBody) {
		this.logger.log("update");
		return (await this.repo.update(id, fields)) ?? notFound();
	}

	async delete(id: string) {
		this.logger.log("delete");
		if (!(await this.repo.delete(id))) {
			notFound();
		}
	}
}

function notFound(): never {
	throw new NotFoundError("Tag de contexte introuvable");
}
