import type {
	LifespanEvent,
	LifespanEventSaveType,
	LifespanPossessionStatus,
	LifespanUsageStatus,
} from "@personal-tracker/shared/lifespan";

import { randomUUID } from "node:crypto";

export interface LifespanEventMongo {
	id: string;
	type: string;
	date: string;
	cause?: string;
	comment?: string;
	created?: string;
}

export interface LifespanObjectMongo {
	id: string;
	name: string;
	description?: string;
	type?: string;
	categoryId: string;
	events: Array<LifespanEventMongo>;
}

// usageStatus / possessionStatus are derived on read, never stored
export type LifespanObjectWithStatusMongo = LifespanObjectMongo & {
	usageStatus: LifespanUsageStatus;
	possessionStatus: LifespanPossessionStatus;
};

export function buildLifespanEvent(input: LifespanEventSaveType): LifespanEvent {
	return {
		...input,
		id: randomUUID(),
		created: Temporal.Now.plainDateTimeISO().toString(),
	} as LifespanEvent;
}

export function sortEventsDesc(
	a: Pick<LifespanEventMongo, "date" | "created">,
	b: Pick<LifespanEventMongo, "date" | "created">,
) {
	if (b.date === a.date) {
		return (b.created ?? "").localeCompare(a.created ?? "");
	}
	return b.date.localeCompare(a.date);
}

// The optional fields absent from `data`: the update removes them, as $set alone would keep them
export function missingFields(data: object, fields: ReadonlyArray<string>) {
	return fields.filter((field) => (data as Record<string, unknown>)[field] === undefined);
}
