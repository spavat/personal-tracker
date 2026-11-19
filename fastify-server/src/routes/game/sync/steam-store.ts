import * as z from "zod";

import { fetchStoreJson } from "./connector";
import { normalizeName } from "./sync.entity";

const STORE_API = "https://store.steampowered.com/api";
// appdetails is rate-limited (about 200 calls per 5 minutes): an import of a whole library stays under it
const MIN_INTERVAL_MS = 1500;

const AppDetailsSchema = z.record(
	z.string(),
	z.object({
		success: z.boolean(),
		data: z
			.object({
				name: z.string(),
				developers: z.array(z.string()).optional(),
				publishers: z.array(z.string()).optional(),
				header_image: z.string().optional(),
				// capsule_imagev5 is the 184x69 one, capsule_image the 231x87 one
				capsule_imagev5: z.string().optional(),
				capsule_image: z.string().optional(),
			})
			.optional(),
	}),
);
const StoreSearchSchema = z.object({
	items: z.array(z.object({ type: z.string(), id: z.number(), name: z.string() })),
});

export interface SteamAppDetails {
	developer?: string;
	publisher?: string;
	capsule?: string;
	header?: string;
}

/** Steam store info (developer, publisher, pictures) of any Steam app, owned or not. No key needed. */
export class SteamStore {
	private lastCall = 0;

	constructor(private wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))) {}

	async details(appId: string): Promise<SteamAppDetails | null> {
		const raw = await this.get(`${STORE_API}/appdetails?appids=${encodeURIComponent(appId)}&l=french`);
		const data = AppDetailsSchema.safeParse(raw).data?.[appId]?.data;
		if (!data) return null;
		const capsule = data.capsule_imagev5 ?? data.capsule_image;
		return {
			...(data.developers?.[0] ? { developer: data.developers[0] } : {}),
			...(data.publishers?.[0] ? { publisher: data.publishers[0] } : {}),
			...(capsule ? { capsule } : {}),
			...(data.header_image ? { header: data.header_image } : {}),
		};
	}

	/** The Steam app with exactly this name (normalized): a near match is another game ("Hades" → not "Hades II"). */
	async findAppId(name: string): Promise<string | undefined> {
		const url = `${STORE_API}/storesearch/?term=${encodeURIComponent(name)}&cc=fr&l=french`;
		const items = StoreSearchSchema.safeParse(await this.get(url)).data?.items ?? [];
		const wanted = normalizeName(name);
		const match = items.find((item) => item.type === "app" && normalizeName(item.name) === wanted);
		return match ? String(match.id) : undefined;
	}

	private async get(url: string) {
		const elapsed = Date.now() - this.lastCall;
		if (elapsed < MIN_INTERVAL_MS) await this.wait(MIN_INTERVAL_MS - elapsed);
		this.lastCall = Date.now();
		return fetchStoreJson("Steam store", url);
	}
}
