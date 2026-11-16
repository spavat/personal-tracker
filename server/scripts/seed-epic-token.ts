// Gives the server the Epic session of a Legendary login (the server then refreshes it by itself).
// Usage, from server/, after `legendary auth`: npx tsx scripts/seed-epic-token.ts [path/to/legendary/user.json]
// Refreshing from the server may end Legendary's own session: `legendary auth` again if Legendary is still used.
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import "dotenv/config";

import { CredentialRepository } from "../src/routes/game/sync/credential.repository";

const path = process.argv[2] ?? join(homedir(), ".config", "legendary", "user.json");
const user = JSON.parse(readFileSync(path, "utf8"));
if (!user.refresh_token || !user.account_id || !user.refresh_expires_at) {
	console.error(`No Epic session in ${path}: run \`legendary auth\` first`);
	process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URL ?? "mongodb://localhost:27017/personal_tracker");
const credentials = new CredentialRepository({ db: client.db() } as any);

credentials
	.saveEpic({
		accountId: user.account_id,
		refreshToken: user.refresh_token,
		refreshExpiresAt: user.refresh_expires_at,
		// Legendary's access token is still valid: reusing it avoids a refresh on the first run
		...(user.access_token && user.expires_at
			? { accessToken: user.access_token, accessExpiresAt: user.expires_at }
			: {}),
	})
	.then(() =>
		console.log(`Epic session saved (account ${user.account_id}, refresh until ${user.refresh_expires_at})`),
	)
	.finally(() => client.close());
