import { eq } from "drizzle-orm";

import type { db } from "./index";

import { coreEntity, coreEntityGroup, coreEntityOrganization, coreEntityPerson, coreNode } from "./schema";

type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type NodeType = (typeof coreNode.$inferInsert)["type"];
export type EntityKind = (typeof coreEntity.$inferInsert)["kind"];

const ENTITY_SUBTYPE_TABLE = {
	person: coreEntityPerson,
	group: coreEntityGroup,
	organization: coreEntityOrganization,
} as const;

// Every linkable row is created with its node, in the caller's transaction, with the same id.
export async function createNode(tx: Tx, { type, label, id }: { type: NodeType; label: string; id?: string }) {
	const [node] = await tx.insert(coreNode).values({ id, type, label }).returning({ id: coreNode.id });
	return node.id;
}

export function renameNode(tx: Tx | Db, id: string, label: string) {
	return tx.update(coreNode).set({ label }).where(eq(coreNode.id, id));
}

// Node + entity + the subtype row of its kind. `id` keeps a chosen uuid (a portrait uploaded beforehand).
export async function createEntity(
	tx: Tx,
	{
		kind,
		name,
		sortName = null,
		pictureKey = null,
		id,
	}: { kind: EntityKind; name: string; sortName?: string | null; pictureKey?: string | null; id?: string },
) {
	const entityId = await createNode(tx, { type: "entity", label: name, id });
	const [entity] = await tx.insert(coreEntity).values({ id: entityId, kind, name, sortName, pictureKey }).returning({
		id: coreEntity.id,
		kind: coreEntity.kind,
		name: coreEntity.name,
		sortName: coreEntity.sortName,
		pictureKey: coreEntity.pictureKey,
	});
	await tx.insert(ENTITY_SUBTYPE_TABLE[kind]).values({ id: entityId });
	return entity;
}
