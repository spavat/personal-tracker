import type { LifespanEvent, LifespanEventSaveType } from "@personal-tracker/shared/lifespan";

import { randomUUID } from "crypto";

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

export function buildLifespanEvent(input: LifespanEventSaveType): LifespanEvent {
	return {
		...input,
		id: randomUUID(),
		created: Temporal.Now.plainDateTimeISO().toString(),
	} as LifespanEvent;
}

export function sortEventsDesc(a: LifespanEventMongo, b: LifespanEventMongo) {
	if (b.date === a.date) {
		return (b.created ?? "").localeCompare(a.created ?? "");
	}
	return b.date.localeCompare(a.date);
}
