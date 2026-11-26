import type { ExternalIds, ExternalSource } from "@personal-tracker/shared/common";

import { and, eq, ne, or } from "drizzle-orm";

import type { Drizzle } from "./drizzle.js";

import {
	coreEntity,
	coreEntityGroup,
	coreEntityOrganization,
	coreEntityPerson,
	coreExternalId,
	coreNode,
} from "./schema.js";

export type Tx = Parameters<Parameters<Drizzle["transaction"]>[0]>[0];
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

export function renameNode(tx: Tx | Drizzle, id: string, label: string) {
	return tx.update(coreNode).set({ label }).where(eq(coreNode.id, id));
}

// Node + entity + the subtype row of its kind. `id` keeps a chosen uuid (a portrait uploaded beforehand).
export async function createEntity(
	tx: Tx,
	{
		kind,
		name,
		sortName = null,
		realName = null,
		pictureKey = null,
		id,
	}: {
		kind: EntityKind;
		name: string;
		sortName?: string | null;
		realName?: string | null;
		pictureKey?: string | null;
		id?: string;
	},
) {
	const entityId = await createNode(tx, { type: "entity", label: name, id });
	const [entity] = await tx
		.insert(coreEntity)
		.values({ id: entityId, kind, name, sortName, realName, pictureKey })
		.returning({
			id: coreEntity.id,
			kind: coreEntity.kind,
			name: coreEntity.name,
			sortName: coreEntity.sortName,
			realName: coreEntity.realName,
			pictureKey: coreEntity.pictureKey,
		});
	await tx.insert(ENTITY_SUBTYPE_TABLE[kind]).values({ id: entityId });
	return entity;
}

// Moves an entity to another kind: its subtype row (and the fields specific to its former kind) is replaced. The
// credits point to the entity, not to its kind: they stay.
export async function changeEntityKind(tx: Tx, id: string, from: EntityKind, to: EntityKind) {
	// the subtype row references (id, kind): it goes before the kind changes
	await tx.delete(ENTITY_SUBTYPE_TABLE[from]).where(eq(ENTITY_SUBTYPE_TABLE[from].id, id));
	await tx.update(coreEntity).set({ kind: to }).where(eq(coreEntity.id, id));
	await tx.insert(ENTITY_SUBTYPE_TABLE[to]).values({ id });
}

type ExternalIdRow = { source: ExternalSource; externalId: string };

// The rows of a node's external ids, as `{ openLibrary: "OL…" }`
export function toExternalIds(rows: ExternalIdRow[]): ExternalIds {
	return Object.fromEntries(rows.map(({ source, externalId }) => [source, externalId]));
}

function toRows(externalIds: ExternalIds) {
	return Object.entries(externalIds).flatMap(([source, externalId]) =>
		externalId ? [{ source: source as ExternalSource, externalId }] : [],
	);
}

// The write failed because one of its external ids was saved on another node meanwhile (UNIQUE (source,
// external_id)): Drizzle wraps the Postgres error in `cause`
export function isExternalIdTaken(error: unknown) {
	const cause =
		error instanceof Error ? (error.cause as { code?: string; constraint?: string } | undefined) : undefined;
	return cause?.code === "23505" && cause.constraint === "external_id_source_external_id_key";
}

// Replaces all the external ids of a node
export async function setExternalIds(tx: Tx, nodeId: string, externalIds: ExternalIds) {
	await tx.delete(coreExternalId).where(eq(coreExternalId.nodeId, nodeId));
	const rows = toRows(externalIds);
	if (rows.length) {
		await tx.insert(coreExternalId).values(rows.map((row) => ({ ...row, nodeId })));
	}
}

// The first of these external ids already held by another node than `nodeId` (none: a node to create)
export async function findTakenExternalId(db: Tx | Drizzle, externalIds: ExternalIds, nodeId?: string) {
	const rows = toRows(externalIds);
	if (!rows.length) {
		return undefined;
	}
	const [taken] = await db
		.select({ source: coreExternalId.source, externalId: coreExternalId.externalId })
		.from(coreExternalId)
		.where(
			and(
				or(
					...rows.map(({ source, externalId }) =>
						and(eq(coreExternalId.source, source), eq(coreExternalId.externalId, externalId)),
					),
				),
				nodeId ? ne(coreExternalId.nodeId, nodeId) : undefined,
			),
		)
		.limit(1);
	return taken as ExternalIdRow | undefined;
}
