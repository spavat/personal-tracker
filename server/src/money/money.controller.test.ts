import type { NestNodeApplication } from "@nestjs/platform-node";

import { afterEach, describe, expect, it, vi } from "vitest";

import { makeFakeDrizzle } from "../test-support/fake-drizzle.js";
import { buildTestApp } from "../test-support/test-app.js";
import { MoneyModule } from "./money.module.js";
import { TransactionsService } from "./transactions/transactions.service.js";

const OWNER = { user: { id: "owner" }, session: { id: "session" } };

// `insertResult`: what an insert(...).returning() resolves to
async function setup(session: unknown = OWNER, insertResult: unknown = []) {
	const { db, table } = makeFakeDrizzle({ builderResult: insertResult });
	const app = await buildTestApp(MoneyModule, { drizzle: db, session });
	return { app, table };
}

// a transaction as the database gives it
const transactionRow = () => ({
	id: 1,
	name: "Shop",
	description: null,
	date: "2026-06-10",
	time: null,
	considerationDate: "2026-06-10",
	amount: -10,
	comment: null,
	parentId: null,
	recurrent: false,
	informative: false,
	categoryId: null,
	paymentTypeId: null,
});

describe("MoneyModule controllers", () => {
	let app: NestNodeApplication;

	afterEach(async () => {
		await app.close();
	});

	it("keeps every money route for the owner", async () => {
		({ app } = await setup(null));

		for (const url of ["/money/accounts", "/money/banks/overview", "/money/transactions", "/money/recap"]) {
			expect((await app.inject({ method: "GET", url })).statusCode, url).toBe(401);
		}
	});

	describe("route order", () => {
		it("serves /banks/overview and /banks/tree, not /banks/:id", async () => {
			const ctx = await setup();
			app = ctx.app;

			expect((await app.inject({ method: "GET", url: "/money/banks/overview" })).statusCode).toBe(200);
			expect((await app.inject({ method: "GET", url: "/money/banks/tree" })).statusCode).toBe(200);
			expect(ctx.table("moneyBank").findFirst).not.toHaveBeenCalled();
		});

		it("serves /tags/analytics, not /tags/:id", async () => {
			const ctx = await setup();
			app = ctx.app;

			const res = await app.inject({ method: "GET", url: "/money/tags/analytics?splitParent=true" });

			expect(res.statusCode).toBe(200);
			expect(ctx.table("moneyTag").findFirst).not.toHaveBeenCalled();
		});
	});

	describe("status codes", () => {
		it("answers 201 to a create, 200 to an update and 204 to a delete", async () => {
			const ctx = await setup(OWNER, [{ id: 1 }]);
			app = ctx.app;

			const res = await app.inject({ method: "POST", url: "/money/banks", payload: { name: "Bank" } });
			expect(res.statusCode).toBe(201);

			ctx.table("moneyBank").findFirst.mockResolvedValue({ id: 1, name: "Bank", accounts: [] });
			const updated = await app.inject({ method: "PUT", url: "/money/banks/1", payload: { name: "Bank" } });
			expect(updated.statusCode).toBe(200);

			const deleted = await app.inject({ method: "DELETE", url: "/money/banks/1" });
			expect(deleted.statusCode).toBe(204);
		});

		it("answers 201 to a transaction create and 204 to a transaction delete", async () => {
			const ctx = await setup(OWNER, [{ id: 1 }]);
			app = ctx.app;
			ctx.table("moneyTransaction").findFirst.mockResolvedValue({ ...transactionRow(), children: [] });

			const created = await app.inject({
				method: "POST",
				url: "/money/transactions",
				payload: { name: "Shop", amount: -10, date: "2026-06-10" },
			});
			const deleted = await app.inject({ method: "DELETE", url: "/money/transactions/1" });

			expect(created.statusCode).toBe(201);
			expect(deleted.statusCode).toBe(204);
		});

		it("maps an unknown id to 404 and a refused delete to 409", async () => {
			const ctx = await setup();
			app = ctx.app;

			expect((await app.inject({ method: "GET", url: "/money/accounts/1" })).statusCode).toBe(404);

			ctx.table("moneyBank").findFirst.mockResolvedValue({ id: 1, accounts: [{ id: 10 }] });
			const res = await app.inject({ method: "DELETE", url: "/money/banks/1" });
			expect(res.statusCode).toBe(409);
			expect(res.json()).toMatchObject({
				code: "has_dependents",
				params: { resource: "bank", dependent: "accounts", count: 1 },
			});
		});
	});

	describe("validation", () => {
		it("rejects a non-numeric id with 400", async () => {
			({ app } = await setup());

			for (const url of [
				"/money/payment-types/abc",
				"/money/transactions/abc",
				"/money/transactions/account/abc",
			]) {
				expect((await app.inject({ method: "GET", url })).statusCode, url).toBe(400);
			}
		});

		it("rejects an invalid create body with 400", async () => {
			({ app } = await setup());

			expect(
				(await app.inject({ method: "POST", url: "/money/accounts", payload: { name: 1 } })).statusCode,
			).toBe(400);
		});

		it("requires the recap period", async () => {
			({ app } = await setup());

			expect((await app.inject({ method: "GET", url: "/money/recap" })).statusCode).toBe(400);
			expect(
				(await app.inject({ method: "GET", url: "/money/recap?from=2024-01-01&to=2024-01-31" })).statusCode,
			).toBe(200);
		});
	});

	describe("transaction body", () => {
		const body = { name: "Shop", amount: -10, date: "2026-06-10" };

		it("saves a 0 category / payment type and an empty time or consideration date as null", async () => {
			({ app } = await setup());
			const create = vi
				.spyOn(app.get(TransactionsService), "create")
				.mockResolvedValue(transactionRow() as never);

			const res = await app.inject({
				method: "POST",
				url: "/money/transactions",
				payload: {
					...body,
					categoryId: 0,
					paymentTypeId: 3,
					time: "",
					considerationDate: "",
					// the form's own fields are left out
					withChildren: true,
					children: [
						{ name: "Part", amount: null, categoryId: 5, paymentTypeId: 0, tags: [{ id: 8, name: "x" }] },
					],
				},
			});

			expect(res.statusCode).toBe(201);
			expect(create).toHaveBeenCalledWith({
				...body,
				categoryId: null,
				paymentTypeId: 3,
				time: null,
				considerationDate: null,
				children: [{ name: "Part", amount: null, categoryId: 5, paymentTypeId: null, tags: [{ id: 8 }] }],
			});
		});

		it("refuses a transaction without a date or an amount", async () => {
			({ app } = await setup());

			for (const payload of [
				{ ...body, date: undefined },
				{ ...body, amount: "-10" },
			]) {
				const res = await app.inject({ method: "POST", url: "/money/transactions", payload });
				expect(res.statusCode).toBe(400);
				expect(res.json().code).toBe("validation");
			}
		});

		it("takes the fields sent only on a quick update", async () => {
			({ app } = await setup());
			const patch = vi.spyOn(app.get(TransactionsService), "patch").mockResolvedValue(transactionRow() as never);

			const res = await app.inject({
				method: "PATCH",
				url: "/money/transactions/1",
				payload: { id: 1, name: "New", categoryId: 0 },
			});

			expect(res.statusCode).toBe(200);
			expect(patch).toHaveBeenCalledWith(1, { name: "New", categoryId: null });
		});
	});
});
