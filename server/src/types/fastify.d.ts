import "fastify";
import { db } from "../db";

declare module "fastify" {
	interface FastifyInstance {
		db: typeof db;
	}
}
