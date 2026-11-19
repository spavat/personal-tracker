import type { FastifyBaseLogger } from "fastify";

import { vi } from "vitest";

/**
 * Silent stand-in for a Fastify/pino logger.
 * Every level is a `vi.fn()`, and `child()` returns the same fake so logs from child loggers can be asserted too.
 * Pass `verbose: true` (or run with `LOG_TESTS=1`) to also print the logs while debugging a test.
 */
export function makeLog({ verbose = process.env.LOG_TESTS === "1" } = {}) {
	const level = (name: string) =>
		vi.fn((...args: unknown[]) => {
			if (verbose) console.log(`[${name}]`, ...args);
		});
	const log = {
		level: "info",
		fatal: level("fatal"),
		error: level("error"),
		warn: level("warn"),
		info: level("info"),
		debug: level("debug"),
		trace: level("trace"),
		silent: vi.fn(),
		child: vi.fn((bindings: object) => {
			if (verbose) console.log("[child]", bindings);
			return log;
		}),
	};
	return log;
}

export type FakeLog = ReturnType<typeof makeLog>;

export const asLog = (log: FakeLog) => log as unknown as FastifyBaseLogger;
