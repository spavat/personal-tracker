import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "./db";
import { authAccount, authSession, authUser, authVerification } from "./db/schema";

// Single owner account: logged in = owner. Sign-up is closed, the account is created with scripts/create-owner.ts
export const authOptions = {
	basePath: "/auth",
	baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
	secret: process.env.BETTER_AUTH_SECRET,
	trustedOrigins: [process.env.FRONT_URL ?? "http://localhost:5173"],
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: { user: authUser, session: authSession, account: authAccount, verification: authVerification },
	}),
	emailAndPassword: { enabled: true, disableSignUp: true },
} satisfies BetterAuthOptions;

export const auth = betterAuth(authOptions);
