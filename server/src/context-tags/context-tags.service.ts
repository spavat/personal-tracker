import { Injectable, Logger } from "@nestjs/common";
import { SaveContextTagBody } from "@personal-tracker/shared/context-tag";

import { NotFoundError } from "../common/errors.js";
import { buildContextTag } from "./context-tags.entity.js";
import { ContextTagsRepository } from "./context-tags.repository.js";

@Injectable()
export class ContextTagsService {
	private readonly logger = new Logger(ContextTagsService.name);
	constructor(private readonly repo: ContextTagsRepository) {}

	list() {
		this.logger.log("list");
		return this.repo.findAll();
	}

	async save({ id, ...fields }: SaveContextTagBody) {
		this.logger.log("save");
		if (id) {
			const result = await this.repo.update(id, fields);
			if (result.matchedCount === 0) {
				throw new NotFoundError("Tag de contexte introuvable");
			}
			return result;
		}
		return await this.repo.insert(buildContextTag(fields));
	}

	async delete(id: string) {
		this.logger.log("delete");
		const result = await this.repo.delete(id);
		if (result.deletedCount === 0) {
			throw new NotFoundError("Tag de contexte introuvable");
		}
		return result;
	}
}
