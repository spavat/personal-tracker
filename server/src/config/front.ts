import "dotenv/config";

// Origins the front is served from, comma-separated (e.g. localhost and the LAN IP to test from a phone).
// Used for CORS and as BetterAuth trusted origins (sign-in is refused from any other origin).
export const FRONT_URLS = (process.env.FRONT_URL ?? "http://localhost:5173").split(",").map((url) => url.trim());
