import type { EntityKind, SaveEntityBody } from "@personal-tracker/shared/entity";
import type { FastifyBaseLogger } from "fastify";

import { randomUUID } from "node:crypto";

import type { EntityRepository } from "./entity.repository";
import type { PortraitStorageRepository } from "./portrait-storage.repository";

import { toEntityView } from "./entity.entity";

export class ListEntitiesUseCase {
	constructor(private repo: EntityRepository) {}

	async execute(query: { kind?: EntityKind; search?: string }, log: FastifyBaseLogger) {
		log.info("ListEntitiesUseCase.execute");
		return (await this.repo.findAll(query)).map(toEntityView);
	}
}

export class SaveEntityUseCase {
	constructor(
		private repo: EntityRepository,
		private portraits: PortraitStorageRepository,
	) {}

	// undefined when updating an unknown entity (or with another kind)
	async execute({ id, picture, ...entity }: SaveEntityBody, log: FastifyBaseLogger) {
		log.info("SaveEntityUseCase.execute");
		const current = id ? await this.repo.findById(id) : undefined;
		if (id && current?.kind !== entity.kind) {
			return undefined;
		}
		const entityId = id ?? randomUUID();

		// left out or the URL given by the server = unchanged, another source = new portrait, null = none
		let pictureKey = current?.pictureKey ?? null;
		if (picture === null) {
			pictureKey = null;
		} else if (picture && !this.portraits.isOwnUrl(picture)) {
			pictureKey = await this.portraits.upload(entityId, picture);
		}

		const fields = { ...entity, id: entityId, pictureKey };
		const saved = current ? await this.repo.update(fields) : await this.repo.create(fields);
		if (!saved) {
			if (pictureKey && pictureKey !== current?.pictureKey) {
				await deletePortrait(this.portraits, pictureKey, log);
			}
			return undefined;
		}
		// the former portrait was replaced or removed
		if (current?.pictureKey && current.pictureKey !== pictureKey) {
			await deletePortrait(this.portraits, current.pictureKey, log);
		}
		return toEntityView(saved);
	}
}

// A portrait left behind in S3 is harmless: its deletion never fails the request
async function deletePortrait(portraits: PortraitStorageRepository, key: string, log: FastifyBaseLogger) {
	try {
		await portraits.deleteObject(key);
	} catch (error) {
		log.warn({ error, key }, "portrait not deleted");
	}
}
