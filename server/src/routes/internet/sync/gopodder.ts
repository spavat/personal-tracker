import { GopodderEpisodeActionsResponseSchema } from "@personal-tracker/shared/internet";

import { GOPODDER_ENABLED, GOPODDER_PASSWORD, GOPODDER_URL, GOPODDER_USERNAME } from "../../../config/gopodder";

export async function fetchEpisodeActions(since: number) {
	if (!GOPODDER_ENABLED) {
		throw new Error("gopodder n'est pas configuré");
	}
	const url = `${GOPODDER_URL}/api/2/episodes/${encodeURIComponent(GOPODDER_USERNAME)}.json?since=${since}`;
	const credentials = Buffer.from(`${GOPODDER_USERNAME}:${GOPODDER_PASSWORD}`).toString("base64");
	const response = await fetch(url, { headers: { Authorization: `Basic ${credentials}` } });
	if (!response.ok) {
		throw new Error(`gopodder : erreur ${response.status}`);
	}
	return GopodderEpisodeActionsResponseSchema.parse(await response.json());
}
