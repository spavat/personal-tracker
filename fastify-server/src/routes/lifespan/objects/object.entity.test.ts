import { describe, expect, it } from "vitest";

import { buildLifespanEvent, sortEventsDesc as sortEventsDescStrict } from "./object.entity";

// the fixtures below only carry the fields sortEventsDesc actually reads
const sortEventsDesc = sortEventsDescStrict as (
	a: { date: string; created?: string },
	b: { date: string; created?: string },
) => number;

describe("buildLifespanEvent", () => {
	it("keeps the input fields and stamps a fresh id and created timestamp", () => {
		const event = buildLifespanEvent({ type: "note", date: "2024-06-01", comment: "great" });

		expect(event).toMatchObject({ type: "note", date: "2024-06-01", comment: "great" });
		expect(event.id).toEqual(expect.any(String));
		expect(event.created).toEqual(expect.any(String));
	});

	it("regenerates the id even when the input already has one", () => {
		const event = buildLifespanEvent({ id: "provided-id", type: "note", date: "2024-06-01" } as never);
		expect(event.id).not.toBe("provided-id");
	});

	it("returns a different id on each call", () => {
		expect(buildLifespanEvent({ type: "note", date: "2024-06-01" }).id).not.toBe(
			buildLifespanEvent({ type: "note", date: "2024-06-01" }).id,
		);
	});
});

describe("sortEventsDesc", () => {
	it("orders by date descending", () => {
		const events = [{ date: "2024-01-01" }, { date: "2024-03-01" }, { date: "2024-02-01" }];
		expect([...events].sort(sortEventsDesc).map((e) => e.date)).toEqual(["2024-03-01", "2024-02-01", "2024-01-01"]);
	});

	it("breaks ties on created descending", () => {
		const a = { date: "2024-01-01", created: "2024-01-01T08:00:00" };
		const b = { date: "2024-01-01", created: "2024-01-01T20:00:00" };
		expect([a, b].sort(sortEventsDesc)).toEqual([b, a]);
	});

	it("tolerates a missing created on a tie", () => {
		const a = { date: "2024-01-01" };
		const b = { date: "2024-01-01", created: "2024-01-01T20:00:00" };
		expect([a, b].sort(sortEventsDesc)).toEqual([b, a]);
	});
});
