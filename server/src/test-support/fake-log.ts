import { vi } from "vitest";

import type { UseCaseLog } from "../common/use-case-log.js";

/**
 * Silent pino-style logger (the framework-free use cases'). Every level is a `vi.fn()`.
 * Pass `verbose: true` (or run with `LOG_TESTS=1`) to also print the logs while debugging a test.
 */
export function makeLog({ verbose = process.env.LOG_TESTS === "1" } = {}) {
	const level = (name: string) =>
		vi.fn((...args: unknown[]) => {
			if (verbose) console.log(`[${name}]`, ...args);
		});
	return { error: level("error"), warn: level("warn"), info: level("info") };
}

export type FakeLog = ReturnType<typeof makeLog>;

export const asLog = (log: FakeLog) => log as UseCaseLog;
