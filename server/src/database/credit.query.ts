import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import { and, eq, sql } from "drizzle-orm";

import type { Tx } from "./node.query.js";

// A <work>_contributor table: (<work>_id, entity_id, role) is its primary key
type CreditTable = PgTable & { entityId: AnyPgColumn };

// Gives the credits of an entity to another one (a merge). `work`: the SQL name of the credited work's column.
// A credit the other entity already has (same work and role) is dropped instead.
export async function moveCredits(tx: Tx, table: CreditTable, work: string, fromId: string, toId: string) {
	const workColumn = sql.raw(work);
	await tx.delete(table).where(
		and(
			eq(table.entityId, fromId),
			sql`exists (
				select 1 from ${table} kept
				where kept.entity_id = ${toId} and kept.${workColumn} = ${table}.${workColumn} and kept.role = ${table}.role
			)`,
		),
	);
	await tx
		.update(table)
		.set({ entityId: toId } as never)
		.where(eq(table.entityId, fromId));
}
