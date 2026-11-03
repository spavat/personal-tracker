import { describe, expect, it } from "vitest";

import { privacyMatch, runInRequestContext, setViewerIsOwner, viewerIsOwner } from "./request-context";

describe("request context", () => {
	it("treats the viewer as anonymous outside a request context", () => {
		setViewerIsOwner(true); // no-op without a context
		expect(viewerIsOwner()).toBe(false);
		expect(privacyMatch()).toEqual({ private: { $ne: true } });
	});

	it("starts anonymous and follows setViewerIsOwner inside a context", () => {
		runInRequestContext(() => {
			expect(viewerIsOwner()).toBe(false);
			setViewerIsOwner(true);
			expect(viewerIsOwner()).toBe(true);
			expect(privacyMatch()).toEqual({});
		});
	});
});
