import type { FastifyPluginAsync } from "fastify";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildRouteApp } from "../test-support/route-harness";
import authPlugin from "./auth";

const { getSession, handler } = vi.hoisted(() => ({ getSession: vi.fn(), handler: vi.fn() }));

vi.mock("../auth", () => ({
	auth: { options: { basePath: "/auth", baseURL: "http://localhost:3000" }, api: { getSession }, handler },
}));

const routes: FastifyPluginAsync = async (fastify) => {
	await fastify.register(authPlugin);
	fastify.get("/private", async () => ({ ok: true }));
	fastify.get("/public", { config: { public: true } }, async (request) => ({ isOwner: request.isOwner }));
	fastify.post("/public", { config: { public: true } }, async () => ({ ok: true }));
	fastify.delete("/items/:id", async () => ({ ok: true }));
};

describe("auth plugin", () => {
	let app: Awaited<ReturnType<typeof buildRouteApp>>;

	beforeEach(async () => {
		getSession.mockReset();
		app = await buildRouteApp(routes);
	});
	afterEach(async () => {
		await app.close();
	});

	describe("anonymous visitor", () => {
		beforeEach(() => getSession.mockResolvedValue(null));

		it("401s on a GET route not declared public", async () => {
			const res = await app.inject({ method: "GET", url: "/private" });
			expect(res.statusCode).toBe(401);
		});

		it("reaches a public GET route", async () => {
			const res = await app.inject({ method: "GET", url: "/public" });
			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ isOwner: false });
		});

		it("401s on a write even when the route is flagged public", async () => {
			const res = await app.inject({ method: "POST", url: "/public" });
			expect(res.statusCode).toBe(401);
		});

		it("401s on a DELETE", async () => {
			const res = await app.inject({ method: "DELETE", url: "/items/1" });
			expect(res.statusCode).toBe(401);
		});

		it("reaches the BetterAuth handler without a session lookup", async () => {
			handler.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
			const res = await app.inject({ method: "POST", url: "/auth/sign-in/email", payload: { email: "a@b.c" } });
			expect(res.statusCode).toBe(200);
			expect(getSession).not.toHaveBeenCalled();
			const request: Request = handler.mock.calls[0][0];
			expect(request.url).toBe("http://localhost:3000/auth/sign-in/email");
			expect(await request.json()).toEqual({ email: "a@b.c" });
		});
	});

	describe("owner", () => {
		beforeEach(() => getSession.mockResolvedValue({ user: { id: "owner" }, session: {} }));

		it("reaches private GET routes", async () => {
			const res = await app.inject({ method: "GET", url: "/private" });
			expect(res.statusCode).toBe(200);
		});

		it("can delete", async () => {
			const res = await app.inject({ method: "DELETE", url: "/items/1" });
			expect(res.statusCode).toBe(200);
		});

		it("is flagged on the request", async () => {
			const res = await app.inject({ method: "GET", url: "/public" });
			expect(res.json()).toEqual({ isOwner: true });
		});
	});
});
