// Creates the owner account (sign-up is disabled on the public API).
// Usage, from server/: npx tsx scripts/create-owner.ts <email> <password> [name]
import { betterAuth } from "better-auth";

import { authOptions } from "../src/auth";
import { db } from "../src/db";

const [email, password, name = "Owner"] = process.argv.slice(2);
if (!email || !password) {
	console.error("Usage: npx tsx scripts/create-owner.ts <email> <password> [name]");
	process.exit(1);
}

const auth = betterAuth({ ...authOptions, emailAndPassword: { enabled: true } });

auth.api
	.signUpEmail({ body: { email, password, name } })
	.then(({ user }) => console.log(`Owner created: ${user.email}`))
	.finally(() => db.$client.end());
