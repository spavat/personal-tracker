import sensible from "@fastify/sensible";
import { createSerializerCompiler, createValidatorCompiler } from "@marcalexiei/fastify-type-provider-zod";
import Fastify, { type FastifyPluginAsync, type FastifyPluginCallback } from "fastify";

type AnyPlugin = FastifyPluginAsync<never> | FastifyPluginCallback<never>;

export interface HarnessDecorators {
	mongo?: unknown;
	db?: unknown;
}

/**
 * Boots a bare Fastify instance with the zod type-provider compilers wired,
 * decorates it with whatever fakes are passed, registers a single route plugin,
 * and awaits `ready()`. No autoload, no real DB.
 */
export async function buildRouteApp(plugin: AnyPlugin, decorators: HarnessDecorators = {}) {
	const app = Fastify({ logger: false });
	app.setValidatorCompiler(createValidatorCompiler());
	app.setSerializerCompiler(createSerializerCompiler());
	await app.register(sensible);

	for (const [key, value] of Object.entries(decorators)) {
		if (value !== undefined) app.decorate(key, value as never);
	}

	await app.register(plugin as FastifyPluginAsync);
	await app.ready();

	return app;
}
