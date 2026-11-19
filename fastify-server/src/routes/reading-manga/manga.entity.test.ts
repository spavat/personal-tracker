import { describe, expect, it } from "vitest";

import { buildReading } from "./manga.entity";

describe("buildReading", () => {
	it("keeps the input fields and always stamps a created timestamp", () => {
		const reading = buildReading({ name: "Vol. 1", language: "fr", date: "2024-06-01" });

		expect(reading).toMatchObject({ name: "Vol. 1", language: "fr", date: "2024-06-01" });
		expect(reading.created).toEqual(expect.any(String));
	});

	it("overwrites created even if the input provides one", () => {
		const reading = buildReading({ name: "Vol. 1", created: "1999-01-01T00:00:00" } as never);
		expect(reading.created).not.toBe("1999-01-01T00:00:00");
	});

	it("generates an id, but an explicit input id wins", () => {
		expect(buildReading({ name: "x" } as never).id).toEqual(expect.any(String));
		expect(buildReading({ id: "kept", name: "x" } as never).id).toBe("kept");
	});
});
