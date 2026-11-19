import { vi } from "vitest";

/**
 * Minimal in-memory stand-in for a `@fastify/mongodb` decorator.
 * Every collection method is a `vi.fn()` so tests can assert calls and stub returns.
 */

export function makeCursor(items: unknown[] = []) {
	const cursor: Record<PropertyKey, unknown> = {
		toArray: vi.fn().mockResolvedValue(items),
		next: vi.fn().mockResolvedValue(items[0] ?? null),
	};
	// chainable no-ops that return the same cursor
	for (const method of ["project", "sort", "limit", "skip", "map"]) {
		cursor[method] = vi.fn(() => cursor);
	}
	cursor[Symbol.asyncIterator] = async function* () {
		yield* items as unknown[];
	};
	return cursor;
}

export function makeCollection() {
	return {
		findOne: vi.fn().mockResolvedValue(null),
		insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
		insertMany: vi.fn().mockResolvedValue({ acknowledged: true }),
		updateOne: vi.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
		updateMany: vi.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
		deleteOne: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
		deleteMany: vi.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
		findOneAndDelete: vi.fn().mockResolvedValue(null),
		findOneAndUpdate: vi.fn().mockResolvedValue(null),
		countDocuments: vi.fn().mockResolvedValue(0),
		aggregate: vi.fn(() => makeCursor([])),
		find: vi.fn(() => makeCursor([])),
	};
}

export type FakeCollection = ReturnType<typeof makeCollection>;

/**
 * Returns a fake `fastify.mongo` plus a `collection(name)` accessor that hands back
 * the same stable `FakeCollection` instance for a given name across calls.
 */
export function makeFakeMongo() {
	const collections = new Map<string, FakeCollection>();
	const collection = (name: string) => {
		let existing = collections.get(name);
		if (!existing) {
			existing = makeCollection();
			collections.set(name, existing);
		}
		return existing;
	};

	return { mongo: { db: { collection } }, collection };
}
