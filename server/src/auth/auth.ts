import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { Drizzle } from "../database/drizzle.js";
import { authAccount, authSession, authUser, authVerification } from "../database/schema.js";

// Single owner account: logged in = owner. Sign-up is closed, the account is created with scripts/create-owner.ts
export function createAuth(
	db: Drizzle,
	{
		secret,
		baseURL,
		trustedOrigins,
		allowSignUp = false,
	}: { secret: string; baseURL: string; trustedOrigins: string[]; allowSignUp?: boolean },
) {
	const authOptions = {
		basePath: "/auth",
		baseURL,
		secret,
		trustedOrigins,
		database: drizzleAdapter(db, {
			provider: "pg",
			schema: { user: authUser, session: authSession, account: authAccount, verification: authVerification },
		}),
		// allowSignUp: only for scripts/create-owner.ts
		emailAndPassword: { enabled: true, disableSignUp: !allowSignUp },
	};
	return betterAuth(authOptions);
}
export type Auth = ReturnType<typeof createAuth>;
