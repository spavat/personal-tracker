import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EnableBankingClient } from "./enable-banking.client";

import { makeFakeDrizzle } from "../../../test-support/fake-drizzle";
import { buildRouteApp } from "../../../test-support/route-harness";
import bankingRoutes from "./banking.routes";

async function buildApp() {
	const { db, table } = makeFakeDrizzle();
	const client = {
		listAspsps: vi.fn().mockResolvedValue([{ name: "Mock ASPSP", country: "FI", maximum_consent_validity: 3600 }]),
		startAuth: vi.fn().mockResolvedValue({ url: "https://bank.example/auth" }),
	};
	const plugin = (app: never, _opts: never) =>
		bankingRoutes(app, { client: client as unknown as EnableBankingClient });
	const app = await buildRouteApp(plugin as never, { db });
	return { app, db, table, client };
}

describe("money/banking routes", () => {
	let ctx: Awaited<ReturnType<typeof buildApp>>;

	beforeEach(async () => {
		ctx = await buildApp();
	});
	afterEach(async () => {
		await ctx.app.close();
	});

	it("GET /aspsps requires a country", async () => {
		expect((await ctx.app.inject({ method: "GET", url: "/aspsps" })).statusCode).toBe(400);
		const res = await ctx.app.inject({ method: "GET", url: "/aspsps?country=fi" });
		expect(res.statusCode).toBe(200);
		expect(ctx.client.listAspsps).toHaveBeenCalledWith("FI");
	});

	it("POST /connections creates a pending connection and returns the bank url", async () => {
		ctx.db.insert.mockImplementationOnce(
			() =>
				({
					values: () => ({ returning: () => Promise.resolve([{ id: 4 }]) }),
				}) as never,
		);
		const res = await ctx.app.inject({
			method: "POST",
			url: "/connections",
			payload: { aspspName: "Mock ASPSP", aspspCountry: "FI" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ connectionId: 4, url: "https://bank.example/auth" });
		expect(ctx.client.startAuth).toHaveBeenCalledWith(
			expect.objectContaining({ aspsp: { name: "Mock ASPSP", country: "FI" } }),
		);
	});

	it("GET /connections hides the auth state", async () => {
		ctx.table("moneyBankConnection").findMany.mockResolvedValue([
			{ id: 1, status: "authorized", validUntil: null, authState: "secret", accounts: [] },
		]);
		const res = await ctx.app.inject({ method: "GET", url: "/connections" });
		expect(res.json()).toEqual([{ id: 1, status: "authorized", validUntil: null, accounts: [] }]);
	});

	it("POST /inbox/:id/accept validates the body", async () => {
		const res = await ctx.app.inject({ method: "POST", url: "/inbox/3/accept", payload: { name: "" } });
		expect(res.statusCode).toBe(400);
	});

	it("POST /inbox/:id/ignore returns 404 for an unknown line", async () => {
		const res = await ctx.app.inject({ method: "POST", url: "/inbox/3/ignore" });
		expect(res.statusCode).toBe(404);
	});

	it("POST /inbox/:id/ignore flags the line", async () => {
		ctx.table("moneyBankTransaction").findFirst.mockResolvedValue({ id: 3, ignored: false });
		const res = await ctx.app.inject({ method: "POST", url: "/inbox/3/ignore" });
		expect(res.statusCode).toBe(204);
		expect(ctx.db.update).toHaveBeenCalledTimes(1);
	});
});
