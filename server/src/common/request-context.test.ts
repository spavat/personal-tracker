import { describe, expect, it } from "vitest";

import { privacyMatch, runInRequestContext, setViewerIsOwner, viewerIsOwner } from "./request-context.js";

describe("request context", () => {
	it("treats code outside a request as anonymous (default deny)", () => {
		setViewerIsOwner(true); // no context open: ignored

		expect(viewerIsOwner()).toBe(false);
		expect(privacyMatch()).toEqual({ private: { $ne: true } });
	});

	it("starts every request as anonymous", () => {
		runInRequestContext(() => {
			expect(viewerIsOwner()).toBe(false);
			expect(privacyMatch()).toEqual({ private: { $ne: true } });
		});
	});

	it("shows the private documents once the viewer is the owner", () => {
		runInRequestContext(() => {
			setViewerIsOwner(true);

			expect(viewerIsOwner()).toBe(true);
			expect(privacyMatch()).toEqual({});
		});
	});

	it("keeps the value across awaits", async () => {
		await new Promise<void>((resolve) => {
			runInRequestContext(async () => {
				setViewerIsOwner(true);
				await new Promise((r) => setTimeout(r, 5));

				expect(viewerIsOwner()).toBe(true);
				resolve();
			});
		});
	});

	it("does not leak the owner's value into another request", async () => {
		const results: Record<string, boolean> = {};
		const request = (name: string, isOwner: boolean, delay: number) =>
			new Promise<void>((resolve) => {
				runInRequestContext(async () => {
					setViewerIsOwner(isOwner);
					await new Promise((r) => setTimeout(r, delay));
					results[name] = viewerIsOwner();
					resolve();
				});
			});

		// the owner's request sets its value first, the anonymous one reads last
		await Promise.all([request("owner", true, 5), request("anonymous", false, 10)]);

		expect(results).toEqual({ owner: true, anonymous: false });
	});
});
