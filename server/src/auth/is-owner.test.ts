import type { NestNodeApplication } from "@nestjs/platform-node";

import { Controller, Get, Module } from "@nestjs/common";
import { afterEach, describe, expect, it, type Mock } from "vitest";

import { privacyMatch } from "../common/request-context.js";
import { buildTestApp } from "../test-support/test-app.js";
import { AUTH } from "./auth.tokens.js";
import { IsOwner } from "./is-owner.decorator.js";
import { Public } from "./public.decorator.js";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };

// Test-only route: what a handler (@IsOwner) and a repository (privacyMatch after an await) see
@Controller("probe")
class ProbeController {
	@Get()
	@Public()
	async probe(@IsOwner() isOwner: boolean) {
		await new Promise((r) => setTimeout(r, 5));
		return { isOwner, filter: privacyMatch() };
	}
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe("request context through the guard", () => {
	let app: NestNodeApplication;

	afterEach(async () => {
		await app.close();
	});

	it("hides the private documents from an anonymous visitor", async () => {
		app = await buildTestApp(ProbeModule, { session: null });

		const res = await app.inject({ method: "GET", url: "/probe" });

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ isOwner: false, filter: { private: { $ne: true } } });
	});

	it("shows everything to the owner", async () => {
		app = await buildTestApp(ProbeModule, { session: OWNER });

		const res = await app.inject({ method: "GET", url: "/probe" });

		expect(res.json()).toEqual({ isOwner: true, filter: {} });
	});

	it("keeps concurrent owner and anonymous requests apart", async () => {
		app = await buildTestApp(ProbeModule);
		// owner = any request carrying a cookie
		const getSession = app.get<{ api: { getSession: Mock } }>(AUTH).api.getSession;
		getSession.mockImplementation(({ headers }: { headers: Headers }) =>
			Promise.resolve(headers.has("cookie") ? OWNER : null),
		);

		const [owner, anonymous] = await Promise.all([
			app.inject({ method: "GET", url: "/probe", headers: { cookie: "better-auth.session_token=x" } }),
			app.inject({ method: "GET", url: "/probe" }),
		]);

		expect(owner.json()).toEqual({ isOwner: true, filter: {} });
		expect(anonymous.json()).toEqual({ isOwner: false, filter: { private: { $ne: true } } });
	});
});
