import type { EntityKind, SaveEntityBody } from "@personal-tracker/shared/entity";
import type { FastifyBaseLogger } from "fastify";

import type { EntityRepository } from "./entity.repository";

export class ListEntitiesUseCase {
	constructor(private repo: EntityRepository) {}

	execute(query: { kind?: EntityKind; search?: string }, log: FastifyBaseLogger) {
		log.info("ListEntitiesUseCase.execute");
		return this.repo.findAll(query);
	}
}

export class SaveEntityUseCase {
	constructor(private repo: EntityRepository) {}

	execute({ id, ...entity }: SaveEntityBody, log: FastifyBaseLogger) {
		log.info("SaveEntityUseCase.execute");
		return id ? this.repo.update({ id, ...entity }) : this.repo.create(entity);
	}
}
