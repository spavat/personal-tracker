import { sql, type AnyColumn } from "drizzle-orm";

import { viewerIsOwner } from "../request-context";

// Anonymous visitors only see the performances older than a week (the future ones neither):
export function visiblePerformanceDate(date: AnyColumn) {
	return viewerIsOwner() ? sql`true` : sql`${date}::date <= current_date - 7`;
}

// RQB filter on a performance table, wrapping visiblePerformanceDate
export function visiblePerformanceWhere() {
	return { RAW: (t: { date: AnyColumn }) => visiblePerformanceDate(t.date) };
}

// RQB filter keeping only the rows linked to a visible performance (through their `performance` relation).
// Empty for the owner, so the rows without any performance stay listed.
export function hasVisiblePerformance() {
	return viewerIsOwner() ? {} : { performance: visiblePerformanceWhere() };
}
