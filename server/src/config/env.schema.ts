import z from "zod";

export const envSchema = z.object({
	DATABASE_URL: z.string(),
	MONGODB_URL: z.string(),
	PORT: z.coerce.number().default(3000),
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.url(),
	// Origins the front is served from, comma-separated (e.g. localhost and the LAN IP to test from a phone).
	// Used for CORS and as better-auth trusted origins (sign-in is refused from any other origin).
	FRONT_URL: z
		.string()
		.default("http://localhost:5173")
		.transform((value) => value.split(",").map((url) => url.trim())),
	// S3-compatible Garage (GPX files, thumbnails, images)
	S3_ENDPOINT: z.url().default("http://localhost:9000"),
	S3_REGION: z.string().default("us-east-1"),
	S3_BUCKET: z.string().default("personal-tracker"),
	S3_ACCESS_KEY_ID: z.string().min(1),
	S3_SECRET_ACCESS_KEY: z.string().min(1),
	// gopodder (gpodder.net-compatible sync server fed by AntennaPod): the podcast sync is off when unset
	GOPODDER_URL: z.string().default(""),
	GOPODDER_USERNAME: z.string().default(""),
	GOPODDER_PASSWORD: z.string().default(""),
	// Store playtime sync: a store without its settings is reported as not configured (Epic's token lives in Mongo).
	// Steam: Web API key (https://steamcommunity.com/dev/apikey) and the SteamID64 of the account.
	STEAM_API_KEY: z.string().default(""),
	STEAM_ID: z.string().default(""),
	// GOG: username of a public profile (gog.com/u/<username>)
	GOG_USERNAME: z.string().default(""),
	// The daily 04:00 store sync (the /game/sync routes work either way); "off" disables it, e.g. for the e2e tests.
	// Never run it from two servers on the same database (fastify-server's job included): the playtime would be counted
	// twice and they would fight over Epic's rotating refresh token.
	GAME_SYNC_SCHEDULER: z.enum(["on", "off"]).default("on"),
});

export type Env = z.infer<typeof envSchema>;
