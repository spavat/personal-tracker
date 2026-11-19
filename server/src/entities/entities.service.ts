import type { EntityKind, SaveEntityBody } from "@personal-tracker/shared/entity";

import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { NotFoundError } from "../common/errors.js";
import { EntitiesRepository } from "./entities.repository.js";
import { toEntityView } from "./entity.entity.js";
import { PortraitStorage } from "./portrait.storage.js";

@Injectable()
export class EntitiesService {
	private readonly logger = new Logger(EntitiesService.name);

	constructor(
		private readonly repo: EntitiesRepository,
		private readonly portraits: PortraitStorage,
	) {}

	async list(query: { kind?: EntityKind; search?: string }) {
		this.logger.log("list");
		return (await this.repo.findAll(query)).map(toEntityView);
	}

	create(body: SaveEntityBody) {
		this.logger.log("create");
		return this.write(undefined, body);
	}

	// 404 for an unknown entity, or one of another kind
	async update(id: string, body: SaveEntityBody) {
		this.logger.log("update");
		return (await this.write(id, body)) ?? notFound();
	}

	// undefined when updating an unknown entity (or with another kind)
	private async write(id: string | undefined, { picture, ...entity }: Omit<SaveEntityBody, "id">) {
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

function notFound(): never {
	throw new NotFoundError("entity");
}
