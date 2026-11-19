// Creates the owner account (sign-up is disabled on the public API).
// Usage, from server/ after a build: npm run create-owner -- <email> <password> [name]
import { createAuth } from "../auth/auth.js";
import { envSchema } from "../config/env.schema.js";
import { createDrizzle } from "../database/drizzle.js";

const [email, password, name = "Owner"] = process.argv.slice(2);
if (!email || !password) {
	console.error("Usage: npm run create-owner -- <email> <password> [name]");
	process.exit(1);
}

const env = envSchema
	.pick({ DATABASE_URL: true, BETTER_AUTH_SECRET: true, BETTER_AUTH_URL: true, FRONT_URL: true })
	.parse(process.env);
const db = createDrizzle(env.DATABASE_URL);
const auth = createAuth(db, {
	secret: env.BETTER_AUTH_SECRET,
	baseURL: env.BETTER_AUTH_URL,
	trustedOrigins: env.FRONT_URL,
	allowSignUp: true,
});

await auth.api
	.signUpEmail({ body: { email, password, name } })
	.then(({ user }) => console.log(`Owner created: ${user.email}`))
	.finally(() => db.$client.end());
