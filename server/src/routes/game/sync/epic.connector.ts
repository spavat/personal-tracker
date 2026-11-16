import type { GameOrigin } from "@personal-tracker/shared/game";

import * as z from "zod";

import type { StoreConnector, StoreGame } from "./connector";
import type { CredentialRepository, EpicCredential } from "./credential.repository";

import { fetchStoreJson } from "./connector";

// Epic has no public playtime API: these are the launcher's own endpoints and public client, as used by
// Legendary (legendary-gl, legendary/api/egs.py).
const OAUTH_URL = "https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token";
const LAUNCHER_CLIENT = "34a02cf8f4414e29b15921876da36f9a:daafbccc737745039dffe53d94fc76cf";
const LAUNCHER_USER_AGENT = "UELauncher/11.0.1-14907503+++Portal+Release-Live Windows/10.0.19041.1.256.64bit";
const LIBRARY_HOST = "https://library-service.live.use1a.on.epicgames.com";
const CATALOG_HOST = "https://catalog-public-service-prod06.ol.epicgames.com";
const ENTITLEMENT_HOST = "https://entitlement-public-service-prod08.ol.epicgames.com";
const ENTITLEMENTS_PAGE = 1000;
// refresh a bit before the access token expires, so a run never starts with an expiring token
const ACCESS_TOKEN_MARGIN = { minutes: 10 };

const OAuthTokenSchema = z.object({
	access_token: z.string(),
	expires_at: z.string(),
	refresh_token: z.string(),
	refresh_expires_at: z.string(),
	account_id: z.string(),
});
const PlaytimeSchema = z.array(z.object({ artifactId: z.string(), totalTime: z.number() }));
const LibraryPageSchema = z.object({
	records: z.array(z.object({ appName: z.string(), namespace: z.string(), catalogItemId: z.string() })),
	responseMetadata: z.object({ nextCursor: z.string().optional() }).optional(),
});
const CatalogItemSchema = z.object({
	title: z.string(),
	developer: z.string().optional(),
	keyImages: z.array(z.object({ type: z.string(), url: z.string() })).optional(),
});
type CatalogItem = z.infer<typeof CatalogItemSchema>;
// what the account owns, with when it got it: a game's entitlements share its namespace (DLCs too)
const EntitlementsSchema = z.array(z.object({ namespace: z.string(), grantDate: z.string() }));

// raw snapshot: the playtimes plus the catalog info and acquisition date of the played games
// (keyed by artifactId = launcher app name); `acquired` is missing from the snapshots taken before it existed
const EpicRawSchema = z.object({
	playtime: PlaytimeSchema,
	catalog: z.record(z.string(), CatalogItemSchema),
	acquired: z.record(z.string(), z.string()).optional(),
});

export class EpicConnector implements StoreConnector {
	store = "epic" as const;
	origins: GameOrigin[] = ["epic"];

	constructor(
		private credentials: CredentialRepository,
		private now: () => Temporal.Instant = () => Temporal.Now.instant(),
	) {}

	async isConfigured() {
		return Boolean(await this.credentials.getEpic());
	}

	async fetchRaw() {
		const { accessToken, accountId } = await this.session();
		const headers = { Authorization: `bearer ${accessToken}`, "User-Agent": LAUNCHER_USER_AGENT };

		const playtime = PlaytimeSchema.parse(
			await fetchStoreJson("Epic", `${LIBRARY_HOST}/library/api/public/playtime/account/${accountId}/all`, {
				headers,
			}),
		);
		const played = new Set(playtime.filter((p) => p.totalTime > 0).map((p) => p.artifactId));

		// library: app name → catalog item, to get the played games' titles
		const items = new Map<string, { namespace: string; catalogItemId: string }>();
		let cursor: string | undefined;
		do {
			const url = new URL(`${LIBRARY_HOST}/library/api/public/items`);
			// without includeMetadata, Epic leaves out responseMetadata and its pagination cursor
			url.search = new URLSearchParams({ includeMetadata: "true", ...(cursor ? { cursor } : {}) }).toString();
			const page = LibraryPageSchema.parse(await fetchStoreJson("Epic", url.toString(), { headers }));
			for (const record of page.records) {
				if (played.has(record.appName)) items.set(record.appName, record);
			}
			cursor = page.responseMetadata?.nextCursor;
		} while (cursor);

		const catalog: Record<string, CatalogItem> = {};
		for (const [appName, { namespace, catalogItemId }] of items) {
			const url = new URL(`${CATALOG_HOST}/catalog/api/shared/namespace/${namespace}/bulk/items`);
			url.search = new URLSearchParams({ id: catalogItemId, country: "FR", locale: "fr" }).toString();
			const result = z
				.record(z.string(), CatalogItemSchema)
				.safeParse(await fetchStoreJson("Epic", url.toString(), { headers }));
			const item = result.success ? result.data[catalogItemId] : undefined;
			if (item) {
				catalog[appName] = { title: item.title, developer: item.developer, keyImages: item.keyImages };
			}
		}

		// acquisition date: the earliest entitlement of the game's namespace (the game before its DLCs)
		const firstGrant = new Map<string, string>();
		for (let start = 0; ; start += ENTITLEMENTS_PAGE) {
			const url = `${ENTITLEMENT_HOST}/entitlement/api/account/${accountId}/entitlements?start=${start}&count=${ENTITLEMENTS_PAGE}`;
			const page = EntitlementsSchema.parse(await fetchStoreJson("Epic", url, { headers }));
			for (const { namespace, grantDate } of page) {
				const known = firstGrant.get(namespace);
				if (!known || Temporal.Instant.compare(grantDate, known) < 0) firstGrant.set(namespace, grantDate);
			}
			if (page.length < ENTITLEMENTS_PAGE) break;
		}
		const acquired: Record<string, string> = {};
		for (const [appName, { namespace }] of items) {
			const grantDate = firstGrant.get(namespace);
			if (grantDate) acquired[appName] = grantDate;
		}

		return { playtime, catalog, acquired };
	}

	parse(raw: unknown): StoreGame[] {
		const { playtime, catalog, acquired } = EpicRawSchema.parse(raw);
		return playtime
			.filter((p) => p.totalTime > 0)
			.map(({ artifactId, totalTime }) => {
				const item = catalog[artifactId];
				const image = item?.keyImages?.find((k) => k.type === "DieselGameBox")?.url;
				return {
					storeGameId: artifactId,
					origin: "epic" as const,
					// Epic counts seconds; no last session date, only when the game was acquired
					seconds: totalTime,
					...(acquired?.[artifactId]
						? { acquiredAt: Temporal.Instant.from(acquired[artifactId]).toString() }
						: {}),
					...(item ? { name: item.title } : {}),
					...(item?.developer ? { developer: item.developer } : {}),
					...(image ? { image } : {}),
				};
			});
	}

	/** A valid access token: the stored one, or a refreshed one (the rotated refresh token is saved). */
	private async session(): Promise<{ accessToken: string; accountId: string }> {
		const credential = await this.credentials.getEpic();
		if (!credential) {
			throw new Error("Epic : pas de jeton (lancer server/scripts/seed-epic-token.ts)");
		}
		if (credential.accessToken && credential.accessExpiresAt && !this.expiresSoon(credential.accessExpiresAt)) {
			return { accessToken: credential.accessToken, accountId: credential.accountId };
		}
		if (Temporal.Instant.compare(this.now(), Temporal.Instant.from(credential.refreshExpiresAt)) >= 0) {
			throw new Error("Epic : jeton expiré, se reconnecter (legendary auth) puis relancer le script");
		}

		const response = await fetch(OAUTH_URL, {
			method: "POST",
			headers: {
				Authorization: `basic ${Buffer.from(LAUNCHER_CLIENT).toString("base64")}`,
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent": LAUNCHER_USER_AGENT,
			},
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: credential.refreshToken,
				token_type: "eg1",
			}).toString(),
		});
		const body = await response.json().catch(() => ({}));
		const token = OAuthTokenSchema.safeParse(body);
		if (!response.ok || !token.success) {
			const errorCode = (body as { errorCode?: string }).errorCode ?? response.status;
			throw new Error(
				`Epic : connexion refusée (${errorCode}), se reconnecter (legendary auth) puis relancer le script`,
			);
		}

		const refreshed: EpicCredential = {
			accountId: token.data.account_id,
			refreshToken: token.data.refresh_token,
			refreshExpiresAt: token.data.refresh_expires_at,
			accessToken: token.data.access_token,
			accessExpiresAt: token.data.expires_at,
		};
		await this.credentials.saveEpic(refreshed);
		return { accessToken: refreshed.accessToken!, accountId: refreshed.accountId };
	}

	private expiresSoon(expiresAt: string) {
		return Temporal.Instant.compare(this.now().add(ACCESS_TOKEN_MARGIN), Temporal.Instant.from(expiresAt)) >= 0;
	}
}
