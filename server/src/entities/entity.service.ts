import type { EntityKind, SaveEntityBody } from "@personal-tracker/shared/entity";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { toEntityView } from "./entity.entity.js";
import { EntityRepository } from "./entity.repository.js";
import { PortraitStorage } from "./portrait.storage.js";

@Injectable()
export class EntityService {
	private readonly logger = new Logger(EntityService.name);

	constructor(
		private readonly repo: EntityRepository,
		private readonly portraits: PortraitStorage,
	) {}

	async list(query: { kind?: EntityKind; search?: string }) {
		this.logger.log("list");
		return (await this.repo.findAll(query)).map(toEntityView);
	}

	// undefined when updating an unknown entity (or with another kind)
	async save({ id, picture, ...entity }: SaveEntityBody) {
		this.logger.log("save");
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
				await this.deletePortrait(pictureKey);
			}
			return undefined;
		}
		// the former portrait was replaced or removed
		if (current?.pictureKey && current.pictureKey !== pictureKey) {
			await this.deletePortrait(current.pictureKey);
		}
		return toEntityView(saved);
	}

	// A portrait left behind in S3 is harmless: its deletion never fails the request
	private async deletePortrait(key: string) {
		try {
			await this.portraits.deleteObject(key);
		} catch (error) {
			this.logger.warn(`portrait not deleted (${key}): ${String(error)}`);
		}
	}
}
