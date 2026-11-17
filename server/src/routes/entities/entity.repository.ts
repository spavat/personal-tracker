import type { EntityKind, SaveEntityBody } from "@personal-tracker/shared/entity";
import type { FastifyInstance } from "fastify";

import { and, asc, eq, sql } from "drizzle-orm";

import { contains } from "../../db/contains";
import { createEntity, renameNode } from "../../db/node";
import { coreEntity } from "../../db/schema";

const ENTITY_COLUMNS = {
	id: coreEntity.id,
	kind: coreEntity.kind,
	name: coreEntity.name,
	sortName: coreEntity.sortName,
};

export class EntityRepository {
	constructor(private db: FastifyInstance["db"]) {}

	findAll({ kind, search }: { kind?: EntityKind; search?: string }) {
		return this.db
			.select(ENTITY_COLUMNS)
			.from(coreEntity)
			.where(
				and(
					kind ? eq(coreEntity.kind, kind) : undefined,
					search ? contains(coreEntity.name, search) : undefined,
				),
			)
			.orderBy(asc(sql`coalesce(${coreEntity.sortName}, ${coreEntity.name})`));
	}

	create({ kind, name, sortName }: Omit<SaveEntityBody, "id">) {
		return this.db.transaction((tx) => createEntity(tx, { kind, name, sortName }));
	}

	// undefined when no entity has this id and kind
	update({ id, kind, name, sortName }: SaveEntityBody & { id: string }) {
		return this.db.transaction(async (tx) => {
			const [entity] = await tx
				.update(coreEntity)
				.set({ name, sortName })
				.where(and(eq(coreEntity.id, id), eq(coreEntity.kind, kind)))
				.returning(ENTITY_COLUMNS);
			if (!entity) {
				return undefined;
			}
			await renameNode(tx, id, name);
			return entity;
		});
	}
}
