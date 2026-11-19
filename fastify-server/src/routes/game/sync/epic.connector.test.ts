import { afterEach, describe, expect, it, vi } from "vitest";

import type { CredentialRepository, EpicCredential } from "./credential.repository";

import { EpicConnector } from "./epic.connector";

const NOW = Temporal.Instant.from("2026-11-13T12:00:00Z");

const credential = (overrides: Partial<EpicCredential> = {}): EpicCredential => ({
	accountId: "account-1",
	refreshToken: "refresh-1",
	refreshExpiresAt: "2027-11-13T15:40:27.755Z",
	accessToken: "access-1",
	accessExpiresAt: "2026-11-15T02:33:47.753Z",
	...overrides,
});

const fakeCredentials = (stored: EpicCredential | null) => {
	const repo = { getEpic: vi.fn().mockResolvedValue(stored), saveEpic: vi.fn().mockResolvedValue({}) };
	return repo as typeof repo & CredentialRepository;
};

// trimmed from real responses (account id replaced)
const PLAYTIME = [
	{ accountId: "account-1", artifactId: "Min", totalTime: 383571 },
	{ accountId: "account-1", artifactId: "e0fa47ae79514345823bff209ae29451", totalTime: 44314 },
	{ accountId: "account-1", artifactId: "Unplayed", totalTime: 0 },
];
const PLAGUE_TALE = {
	title: "A Plague Tale: Innocence",
	developer: "Focus Entertainment Publishing",
	keyImages: [
		{ type: "DieselGameBox", url: "https://cdn1.epicgames.com/wide.jpg" },
		{ type: "DieselGameBoxTall", url: "https://cdn1.epicgames.com/tall.jpg" },
	],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** fetch stub answering each Epic endpoint by path. */
function stubEpic(handlers: { oauth?: () => Response } = {}) {
	const fetch = vi.fn(async (input: string, _init?: RequestInit) => {
		const url = new URL(input);
		if (url.pathname === "/account/api/oauth/token") {
			return handlers.oauth?.() ?? json({}, 500);
		}
		if (url.pathname.startsWith("/library/api/public/playtime/")) {
			return json(PLAYTIME);
		}
		if (url.pathname === "/library/api/public/items") {
			return url.searchParams.get("cursor")
				? json({
						records: [{ appName: "Min", namespace: "ns-hades", catalogItemId: "cat-hades" }],
						responseMetadata: {},
					})
				: json({
						records: [
							{
								appName: "e0fa47ae79514345823bff209ae29451",
								namespace: "ns-plague",
								catalogItemId: "cat-plague",
							},
							{ appName: "NotPlayed", namespace: "ns-x", catalogItemId: "cat-x" },
						],
						// like Epic: no responseMetadata (so no cursor) without includeMetadata=true
						...(url.searchParams.get("includeMetadata") === "true"
							? { responseMetadata: { nextCursor: "page2" } }
							: {}),
					});
		}
		if (url.pathname === "/catalog/api/shared/namespace/ns-plague/bulk/items") {
			return json({ "cat-plague": { ...PLAGUE_TALE, description: "…" } });
		}
		if (url.pathname === "/catalog/api/shared/namespace/ns-hades/bulk/items") {
			return json({ "cat-hades": { title: "Hades" } });
		}
		if (url.pathname === "/entitlement/api/account/account-1/entitlements") {
			return json([
				{ namespace: "ns-plague", grantDate: "2021-08-09T18:53:10.801Z" },
				// a DLC got later: the game's date is the earliest
				{ namespace: "ns-plague", grantDate: "2023-01-01T00:00:00.000Z" },
				{ namespace: "ns-other", grantDate: "2019-01-01T00:00:00.000Z" },
			]);
		}
		throw new Error(`unexpected ${input}`);
	});
	vi.stubGlobal("fetch", fetch);
	return fetch;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("EpicConnector.fetchRaw", () => {
	it("returns the playtimes with the catalog info of the played games only", async () => {
		const fetch = stubEpic();
		const raw = await new EpicConnector(fakeCredentials(credential()), () => NOW).fetchRaw();

		expect(raw).toEqual({
			// only the fields used are kept
			playtime: PLAYTIME.map(({ artifactId, totalTime }) => ({ artifactId, totalTime })),
			catalog: { e0fa47ae79514345823bff209ae29451: PLAGUE_TALE, Min: { title: "Hades" } },
			acquired: { e0fa47ae79514345823bff209ae29451: "2021-08-09T18:53:10.801Z" },
		});
		const paths = fetch.mock.calls.map(([url]) => new URL(url).pathname);
		expect(paths).toContain("/library/api/public/playtime/account/account-1/all");
		expect(paths).not.toContain("/catalog/api/shared/namespace/ns-x/bulk/items");
		expect(paths).not.toContain("/account/api/oauth/token");
	});

	it("reuses a valid access token", async () => {
		const fetch = stubEpic();
		await new EpicConnector(fakeCredentials(credential()), () => NOW).fetchRaw();
		expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "bearer access-1" });
	});

	it("refreshes an expiring access token and saves the rotated refresh token", async () => {
		const fetch = stubEpic({
			oauth: () =>
				json({
					access_token: "access-2",
					expires_at: "2026-11-15T12:00:00Z",
					refresh_token: "refresh-2",
					refresh_expires_at: "2027-11-13T12:00:00Z",
					account_id: "account-1",
				}),
		});
		const credentials = fakeCredentials(credential({ accessExpiresAt: "2026-11-13T12:05:00Z" }));

		await new EpicConnector(credentials, () => NOW).fetchRaw();

		const [, oauthInit] = fetch.mock.calls[0];
		expect(String(oauthInit?.body)).toContain("grant_type=refresh_token");
		expect(String(oauthInit?.body)).toContain("refresh_token=refresh-1");
		expect(credentials.saveEpic).toHaveBeenCalledWith({
			accountId: "account-1",
			refreshToken: "refresh-2",
			refreshExpiresAt: "2027-11-13T12:00:00Z",
			accessToken: "access-2",
			accessExpiresAt: "2026-11-15T12:00:00Z",
		});
		expect(fetch.mock.calls[1][1]?.headers).toMatchObject({ Authorization: "bearer access-2" });
	});

	it("asks to log in again when Epic refuses the refresh token", async () => {
		stubEpic({
			oauth: () => json({ errorCode: "errors.com.epicgames.account.auth_token.invalid_refresh_token" }, 400),
		});
		const credentials = fakeCredentials(credential({ accessToken: undefined, accessExpiresAt: undefined }));

		await expect(new EpicConnector(credentials, () => NOW).fetchRaw()).rejects.toThrow(
			/invalid_refresh_token.*legendary auth/,
		);
		expect(credentials.saveEpic).not.toHaveBeenCalled();
	});

	it("doesn't try an expired refresh token", async () => {
		const fetch = stubEpic();
		const credentials = fakeCredentials(
			credential({ accessExpiresAt: "2026-11-01T00:00:00Z", refreshExpiresAt: "2026-11-02T00:00:00Z" }),
		);
		await expect(new EpicConnector(credentials, () => NOW).fetchRaw()).rejects.toThrow(/expiré/);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("needs a seeded token", async () => {
		const connector = new EpicConnector(fakeCredentials(null), () => NOW);
		expect(await connector.isConfigured()).toBe(false);
		await expect(connector.fetchRaw()).rejects.toThrow(/seed-epic-token/);
	});
});

describe("EpicConnector.parse", () => {
	it("keeps the played games, in seconds, with the catalog title, developer and wide image", () => {
		const games = new EpicConnector(fakeCredentials(null)).parse({
			playtime: PLAYTIME,
			catalog: { e0fa47ae79514345823bff209ae29451: PLAGUE_TALE, Min: { title: "Hades" } },
			acquired: { e0fa47ae79514345823bff209ae29451: "2021-08-09T18:53:10.801Z" },
		});
		expect(games).toEqual([
			{ storeGameId: "Min", origin: "epic", seconds: 383571, name: "Hades" },
			{
				storeGameId: "e0fa47ae79514345823bff209ae29451",
				origin: "epic",
				seconds: 44314,
				name: "A Plague Tale: Innocence",
				developer: "Focus Entertainment Publishing",
				image: "https://cdn1.epicgames.com/wide.jpg",
				acquiredAt: "2021-08-09T18:53:10.801Z",
			},
		]);
	});

	it("reads the snapshots taken before the acquisition dates", () => {
		const games = new EpicConnector(fakeCredentials(null)).parse({
			playtime: [PLAYTIME[0]],
			catalog: { Min: { title: "Hades" } },
		});
		expect(games).toEqual([{ storeGameId: "Min", origin: "epic", seconds: 383571, name: "Hades" }]);
	});

	it("keeps a game missing from the catalog, without a name", () => {
		const games = new EpicConnector(fakeCredentials(null)).parse({ playtime: [PLAYTIME[0]], catalog: {} });
		expect(games).toEqual([{ storeGameId: "Min", origin: "epic", seconds: 383571 }]);
	});
});
