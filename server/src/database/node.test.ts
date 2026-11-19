import { describe, expect, it } from "vitest";

import type { Tx } from "./node.js";

import { makeFakeDrizzle } from "../test-support/fake-drizzle.js";
import { createEntity, createNode } from "./node.js";
import { coreEntity, coreEntityGroup, coreEntityOrganization, coreEntityPerson, coreNode } from "./schema.js";

const ID = "0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e";

function fakeTx() {
	const { db } = makeFakeDrizzle({
		builderResult: [{ id: ID, kind: "person", name: "Lewis Carroll", sortName: null }],
	});
	return { tx: db as unknown as Tx, db };
}

describe("createNode", () => {
	it("inserts a node and returns its id", async () => {
		const { tx, db } = fakeTx();
		expect(await createNode(tx, { type: "book", label: "Alice" })).toBe(ID);
		expect(db.insert).toHaveBeenCalledWith(coreNode);
	});
});

describe("createEntity", () => {
	it("inserts the node, the entity, then the subtype row of its kind", async () => {
		const { tx, db } = fakeTx();
		const entity = await createEntity(tx, { kind: "person", name: "Lewis Carroll" });
		expect(entity).toEqual({ id: ID, kind: "person", name: "Lewis Carroll", sortName: null });
		expect(db.insert.mock.calls.map((call: unknown[]) => call[0])).toEqual([
			coreNode,
			coreEntity,
			coreEntityPerson,
		]);
	});

	it.each([
		["group", coreEntityGroup],
		["organization", coreEntityOrganization],
	] as const)("uses the %s subtype table", async (kind, table) => {
		const { tx, db } = fakeTx();
		await createEntity(tx, { kind, name: "Folio" });
		expect(db.insert).toHaveBeenLastCalledWith(table);
	});
});
