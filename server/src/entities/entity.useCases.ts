import type { EntityKind, SaveEntityBody } from "@personal-tracker/shared/entity";

import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { UseCaseLog } from "../common/use-case-log.js";

import { toEntityView } from "./entity.entity.js";
import { EntityRepository } from "./entity.repository.js";
import { PortraitStorage } from "./portrait.storage.js";

@Injectable()
export class ListEntitiesUseCase {
	constructor(private repo: EntityRepository) {}

	async execute(query: { kind?: EntityKind; search?: string }, log: UseCaseLog) {
		log.info("ListEntitiesUseCase.execute");
		return (await this.repo.findAll(query)).map(toEntityView);
	}
}

@Injectable()
export class SaveEntityUseCase {
	constructor(
		private repo: EntityRepository,
		private portraits: PortraitStorage,
	) {}

	// undefined when updating an unknown entity (or with another kind)
	async execute({ id, picture, ...entity }: SaveEntityBody, log: UseCaseLog) {
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
async function deletePortrait(portraits: PortraitStorage, key: string, log: UseCaseLog) {
	try {
		await portraits.deleteObject(key);
	} catch (error) {
		log.warn({ error, key }, "portrait not deleted");
	}
}
