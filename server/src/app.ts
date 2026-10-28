import AutoLoad, { AutoloadPluginOptions } from "@fastify/autoload";
import cors from "@fastify/cors";
import "@fastify/mongodb";
import { FastifyPluginAsync, FastifyServerOptions } from "fastify";
import { join } from "node:path";

import { FRONT_URLS } from "./config/front";

interface AppOptions extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}
// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {};

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts): Promise<void> => {
	await fastify.register(cors, {
		// credentials: the front sends the session cookie, which requires an explicit origin
		origin: FRONT_URLS,
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	});
	fastify.register(require("@fastify/mongodb"), {
		// force to close the mongodb connection when app stopped
		// the default value is false
		forceClose: true,

		url: process.env.MONGODB_URL ?? "mongodb://localhost:27017/personal_tracker",
	});

	// Do not touch the following lines

	// This loads all plugins defined in plugins
	// those should be support plugins that are reused
	// through your application
	// eslint-disable-next-line no-void
	void fastify.register(AutoLoad, {
		dir: join(__dirname, "plugins"),
		// co-located unit tests (plugins/auth.test.ts)
		ignorePattern: /\.test\.ts$/,
		options: opts,
	});

	// This loads all plugins defined in routes
	// define your routes in one of these
	// eslint-disable-next-line no-void
	void fastify.register(AutoLoad, {
		dir: join(__dirname, "routes"),
		indexPattern: /\.routes\.ts$/,
		options: opts,
	});
};

export default app;
export { app, options };
