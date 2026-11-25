import { Injectable, Logger } from "@nestjs/common";

import type { EntityFields } from "../entities.repository.js";

import { BroadcastRepository } from "../../broadcast/broadcast.repository.js";
import { NotFoundError } from "../../common/errors.js";
import { BookRepository } from "../../reading-book/book.repository.js";
import { ArtistsRepository } from "../../show/artists/artists.repository.js";
import { EntitiesRepository } from "../entities.repository.js";
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
