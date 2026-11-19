import type { NestNodeApplication } from "@nestjs/platform-node";

import { Module } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, type Mock } from "vitest";

import { buildTestApp } from "../test-support/test-app.js";
import { AUTH } from "./auth.tokens.js";

@Module({})
class EmptyModule {}

describe("AuthHandlerMiddleware", () => {
	let app: NestNodeApplication;
	let auth: { api: { getSession: Mock }; handler: Mock };

	beforeEach(async () => {
		app = await buildTestApp(EmptyModule);
		auth = app.get(AUTH);
		// echoes what better-auth receives
		auth.handler.mockImplementation(async (request: Request) =>
			Response.json({ method: request.method, url: request.url, body: await request.text() }),
		);
	});

	afterEach(async () => {
		await app.close();
	});

	it("hands better-auth the full /auth URL, before the guard (no session lookup, no 401)", async () => {
		const res = await app.inject({ method: "GET", url: "/auth/get-session" });

		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ method: "GET", url: expect.stringMatching(/\/auth\/get-session$/) });
		expect(auth.api.getSession).not.toHaveBeenCalled();
	});

	it("passes the JSON body already read by Nest's body parser", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/auth/sign-in/email",
			payload: { email: "owner@example.com", password: "secret" },
		});

		expect(res.json()).toMatchObject({ method: "POST", url: expect.stringMatching(/\/auth\/sign-in\/email$/) });
		expect(JSON.parse(res.json().body)).toEqual({ email: "owner@example.com", password: "secret" });
	});

	it("leaves the other routes to Nest", async () => {
		const res = await app.inject({ method: "GET", url: "/authors" });

		expect(res.statusCode).toBe(404);
		expect(auth.handler).not.toHaveBeenCalled();
	});
});
