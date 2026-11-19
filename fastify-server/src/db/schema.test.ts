import { describe, expect, it } from "vitest";

import { showPerformance } from "./schema";

describe("showPerformance.date", () => {
	it("reads the postgres timestamp as an ISO local date-time", () => {
		expect(showPerformance.date.mapFromDriverValue("2024-01-01 20:00:00")).toBe("2024-01-01T20:00:00");
	});
});
