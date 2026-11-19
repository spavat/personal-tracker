import type { SaveContextTagRequestSchema } from "@personal-tracker/shared/context-tag";
import type { FastifyBaseLogger } from "fastify";
import type { z } from "zod";

import type { ContextTagRepository } from "./context-tag.repository";

import { buildContextTag } from "./context-tag.entity";

type SaveContextTagBody = z.infer<typeof SaveContextTagRequestSchema>;

export class ListContextTagsUseCase {
	constructor(private repo: ContextTagRepository) {}

	execute(log: FastifyBaseLogger) {
		log.info("ListContextTagsUseCase.execute");
		return this.repo.findAll();
	}
}

export class SaveContextTagUseCase {
	constructor(private repo: ContextTagRepository) {}

	execute(contextTag: SaveContextTagBody, log: FastifyBaseLogger) {
		log.info("SaveContextTagUseCase.execute");
		if (contextTag.id) {
			return this.repo.update(contextTag.id, contextTag);
		}
		return this.repo.insert(buildContextTag(contextTag));
	}
}

export class DeleteContextTagUseCase {
	constructor(private repo: ContextTagRepository) {}

	execute(id: string, log: FastifyBaseLogger) {
		log.info("DeleteContextTagUseCase.execute");
		return this.repo.delete(id);
	}
}
