import type { EntityKind } from "@personal-tracker/shared/entity";

import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";

import { contains } from "../database/contains.query.js";
import { DRIZZLE } from "../database/database.tokens.js";
import { Drizzle } from "../database/drizzle.js";
import { createEntity, renameNode } from "../database/node.query.js";
import { coreEntity } from "../database/schema.js";

const ENTITY_COLUMNS = {
	id: coreEntity.id,
	kind: coreEntity.kind,
	name: coreEntity.name,
	sortName: coreEntity.sortName,
	pictureKey: coreEntity.pictureKey,
};

export type EntityFields = {
	id: string;
	kind: EntityKind;
	name: string;
	sortName: string | null;
	pictureKey: string | null;
};

// People, groups and organizations (core_entity), credited by the books and the shows
@Injectable()
export class EntitiesRepository {
	constructor(@Inject(DRIZZLE) private readonly db: Drizzle) {}

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

	// The entities of this kind named exactly like one of these names, case and accents ignored, each with the
	// names it matches ("Émile Zola" and "Emile Zola" both match the entity "Émile Zola")
	findByNames(names: string[], kind: EntityKind) {
		if (!names.length) {
			return Promise.resolve([]);
		}
		const key = (value: unknown) => sql`unaccent(lower(${value}))`;
		const entityKey = key(coreEntity.name);
		return this.db
			.select({
				id: coreEntity.id,
				names: sql<string[]>`array_remove(array[${sql.join(
					names.map((name) => sql`case when ${entityKey} = ${key(name)} then ${name}::text end`),
					sql`, `,
				)}], null)`,
			})
			.from(coreEntity)
			.where(
				and(
					eq(coreEntity.kind, kind),
					sql`${entityKey} in (${sql.join(
						names.map((name) => key(name)),
						sql`, `,
					)})`,
				),
			);
	}

	async findById(id: string) {
		const [entity] = await this.db.select(ENTITY_COLUMNS).from(coreEntity).where(eq(coreEntity.id, id));
		return entity;
	}

	create(entity: EntityFields) {
		return this.db.transaction((tx) => createEntity(tx, entity));
	}

	// undefined when no entity has this id and kind
	update({ id, kind, name, sortName, pictureKey }: EntityFields) {
		return this.db.transaction(async (tx) => {
			const [entity] = await tx
				.update(coreEntity)
				.set({ name, sortName, pictureKey })
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
