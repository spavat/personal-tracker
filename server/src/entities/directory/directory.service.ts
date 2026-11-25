import type { EntityMergeBody } from "@personal-tracker/shared/entity";

import { Injectable, Logger } from "@nestjs/common";

import type { EntityFields } from "../entities.repository.js";

import { BroadcastRepository } from "../../broadcast/broadcast.repository.js";
import { NotFoundError } from "../../common/errors.js";
import { BookRepository } from "../../reading-book/book.repository.js";
import { ArtistsRepository } from "../../show/artists/artists.repository.js";
import { EntitiesRepository } from "../entities.repository.js";
import { PortraitStorage } from "../portrait.storage.js";
import { hasCredits, sortDirectory, toDirectoryItems } from "./directory.entity.js";

// The directory: every entity with its credits counted across the modules. Each module page (show artist,
// reading-book author, broadcast credits) gives the credits themselves.
@Injectable()
export class DirectoryService {
	private readonly logger = new Logger(DirectoryService.name);

	constructor(
		private readonly entities: EntitiesRepository,
		private readonly artists: ArtistsRepository,
		private readonly books: BookRepository,
		private readonly broadcast: BroadcastRepository,
		private readonly portraits: PortraitStorage,
	) {}

	// a visitor only gets the entities with a visible credit. search: in the names.
	async list({ sort, search }: { sort?: string[]; search?: string }, isOwner: boolean) {
		this.logger.log("list");
		const [sortField, sortDirection] = sort ?? ["name", "asc"];
		const items = await this.withCounts(await this.entities.findAll({ search }));
		return sortDirectory(
			items.filter((item) => isOwner || hasCredits(item)),
			sortField,
			sortDirection,
		);
	}

	// 404 for an unknown entity, or one without visible credit for a visitor
	async get(id: string, isOwner: boolean) {
		this.logger.log("get");
		const entity = await this.entities.findById(id);
		const [item] = entity ? await this.withCounts([entity], id) : [];
		if (!item || (!isOwner && !hasCredits(item))) {
			throw new NotFoundError("entity");
		}
		return item;
	}

	// The main entity gets every credit of the secondary one (a credit it already has is dropped), its external ids,
	// sort name and portrait where it has none; the secondary is deleted. 404 for an unknown entity.
	async merge({ keepId, removeId }: EntityMergeBody) {
		this.logger.log("merge");
		const [keep, remove] = await Promise.all([this.entities.findById(keepId), this.entities.findById(removeId)]);
		if (!keep || !remove) {
			throw new NotFoundError("entity");
		}
		await this.entities.runInTransaction(async (tx) => {
			await this.artists.moveEntityCredits(tx, removeId, keepId);
			await this.books.moveEntityCredits(tx, removeId, keepId);
			await this.broadcast.moveEntityCredits(tx, removeId, keepId);
			await this.entities.absorb(tx, keep, remove);
		});
		// the main entity kept its own portrait: the secondary's is left over
		if (keep.pictureKey && remove.pictureKey) {
			await this.deletePortrait(remove.pictureKey);
		}
		return this.get(keepId, true);
	}

	// A portrait left behind in S3 is harmless: its deletion never fails the merge
	private async deletePortrait(key: string) {
		try {
			await this.portraits.deleteObject(key);
		} catch (error) {
			this.logger.warn(`portrait not deleted (${key}): ${String(error)}`);
		}
	}

	// entityId: the entities are only this one (the credits are then only read for it)
	private async withCounts(entities: EntityFields[], entityId?: string) {
		const [show, books, { programs, episodes }] = await Promise.all([
			this.artists.countEntityCredits(entityId),
			this.books.findEntityBookIds(entityId),
			this.broadcast.findEntityCreditIds(entityId),
		]);
		return toDirectoryItems(entities, { show, books, programs, episodes });
	}
}
