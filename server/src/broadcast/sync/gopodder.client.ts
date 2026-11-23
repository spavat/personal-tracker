import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GopodderEpisodeActionsResponseSchema } from "@personal-tracker/shared/broadcast";

import { UpstreamError } from "../../common/errors.js";
import { Env } from "../../config/env.schema.js";

// gopodder (gpodder.net-compatible sync server fed by AntennaPod), read with a dedicated sync login (Basic auth):
// gopodder API keys only work on its admin /api/v1 routes, which don't expose the episode actions.
@Injectable()
export class GopodderClient {
	private readonly url: string;
	private readonly username: string;
	private readonly password: string;

	constructor(config: ConfigService<Env, true>) {
		this.url = config.get("GOPODDER_URL", { infer: true }).replace(/\/$/, "");
		this.username = config.get("GOPODDER_USERNAME", { infer: true });
		this.password = config.get("GOPODDER_PASSWORD", { infer: true });
	}

	async fetchEpisodeActions(since: number) {
		if (!this.url || !this.username || !this.password) {
			throw new UpstreamError("upstream_unavailable", "gopodder is not configured", { service: "gopodder" });
		}
		const url = `${this.url}/api/2/episodes/${encodeURIComponent(this.username)}.json?since=${since}`;
		const credentials = Buffer.from(`${this.username}:${this.password}`).toString("base64");
		const response = await fetch(url, { headers: { Authorization: `Basic ${credentials}` } });
		if (!response.ok) {
			throw new UpstreamError("upstream_unavailable", `gopodder answered ${response.status}`, {
				service: "gopodder",
				status: response.status,
			});
		}
		return GopodderEpisodeActionsResponseSchema.parse(await response.json());
	}
}
