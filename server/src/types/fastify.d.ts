import "fastify";
import { db } from "../db";

declare module "fastify" {
	interface FastifyInstance {
		db: typeof db;
	}

	interface FastifyRequest {
		// set by plugins/auth.ts: true when the request carries a valid session
		isOwner: boolean;
	}

	interface FastifyContextConfig {
		// anonymous visitors may call this (GET) route, see plugins/auth.ts
		public?: boolean;
	}
}
