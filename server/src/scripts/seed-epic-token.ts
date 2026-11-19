// Gives the server the Epic session of a Legendary login (the server then refreshes it by itself).
// Usage, from server/ after a build and `legendary auth`: npm run seed-epic-token -- [path/to/legendary/user.json]
// Refreshing from the server may end Legendary's own session: `legendary auth` again if Legendary is still used.
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { envSchema } from "../config/env.schema.js";
import { CredentialRepository } from "../game/sync/credential.repository.js";

const path = process.argv[2] ?? join(homedir(), ".config", "legendary", "user.json");
const user = JSON.parse(readFileSync(path, "utf8"));
if (!user.refresh_token || !user.account_id || !user.refresh_expires_at) {
	console.error(`No Epic session in ${path}: run \`legendary auth\` first`);
	process.exit(1);
}

const { MONGODB_URL } = envSchema.pick({ MONGODB_URL: true }).parse(process.env);
const client = new MongoClient(MONGODB_URL);
const credentials = new CredentialRepository(client.db());

await credentials
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
