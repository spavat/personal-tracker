import { vi } from "vitest";

/**
 * Permissive stand-in for the Drizzle `fastify.db` decorator, for route-level
 * wiring tests of the `show/*` modules. It does NOT execute real SQL — it only
 * lets the query-builder chains resolve so a handler runs end to end.
 *
 * - `db.query.<table>.findMany/findFirst` are `vi.fn()`s, stable per table name.
 * - `db.select()/insert()/update()/delete()` return a chainable thenable that
 *   awaits to `[]` (override per builder via `results`).
 * - `db.transaction(fn)` calls `fn` with the same fake.
 */

function makeChain(result: unknown) {
	const chain: unknown = new Proxy(() => {}, {
		get(_target, prop) {
			if (prop === "then") {
				return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
					Promise.resolve(result).then(resolve, reject);
			}
			return () => chain;
		},
		apply() {
			return chain;
		},
	});
	return chain;
}

export interface FakeDrizzleOptions {
	/** default resolved value for `select/insert/update/delete` builder chains */
	builderResult?: unknown;
}

export function makeFakeDrizzle(options: FakeDrizzleOptions = {}) {
	const { builderResult = [] } = options;

	const tableFns = new Map<string, { findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> }>();
	const query = new Proxy(
		{},
		{
			get(_target, table: string) {
				let fns = tableFns.get(table);
				if (!fns) {
					fns = {
						findMany: vi.fn().mockResolvedValue([]),
						findFirst: vi.fn().mockResolvedValue(undefined),
					};
					tableFns.set(table, fns);
				}
				return fns;
			},
		},
	);

	const db = {
		query,
		select: vi.fn(() => makeChain(builderResult)),
		insert: vi.fn(() => makeChain(builderResult)),
		update: vi.fn(() => makeChain(builderResult)),
		delete: vi.fn(() => makeChain(builderResult)),
		transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(db)),
	};

	/** grab the `vi.fn()`s for a relational table to assert calls / stub returns */
	const table = (name: string) =>
		query[name as keyof typeof query] as unknown as {
			findMany: ReturnType<typeof vi.fn>;
			findFirst: ReturnType<typeof vi.fn>;
		};

	return { db, table };
}
