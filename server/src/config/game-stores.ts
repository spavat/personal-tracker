import "dotenv/config";

// Store playtime connectors (game sync). A connector without its settings is reported as not configured.
// Steam: Web API key (https://steamcommunity.com/dev/apikey) and the SteamID64 of the account.
export const STEAM_API_KEY = process.env.STEAM_API_KEY ?? "";
export const STEAM_ID = process.env.STEAM_ID ?? "";
// GOG: username of a public profile (gog.com/u/<username>). Epic's token lives in Mongo (scripts/seed-epic-token.ts).
export const GOG_USERNAME = process.env.GOG_USERNAME ?? "";
