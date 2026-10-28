import type { Reading } from "@personal-tracker/shared/reading-manga";

import { randomUUID } from "crypto";

export function buildReading(input: Partial<Reading>): Reading {
	return {
		id: randomUUID(),
		...input,
		created: Temporal.Now.plainDateTimeISO().toString(),
	} as Reading;
}
