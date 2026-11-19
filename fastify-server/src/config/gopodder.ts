import "dotenv/config";

// gopodder (gpodder.net-compatible sync server fed by AntennaPod), read with a dedicated sync login (Basic auth):
// gopodder API keys only work on its admin /api/v1 routes, which don't expose the episode actions.
export const GOPODDER_URL = (process.env.GOPODDER_URL ?? "").replace(/\/$/, "");
export const GOPODDER_USERNAME = process.env.GOPODDER_USERNAME ?? "";
export const GOPODDER_PASSWORD = process.env.GOPODDER_PASSWORD ?? "";
export const GOPODDER_ENABLED = Boolean(GOPODDER_URL && GOPODDER_USERNAME && GOPODDER_PASSWORD);
