import { createValidatorCompiler, createSerializerCompiler } from "@marcalexiei/fastify-type-provider-zod";
import Fastify from "fastify";

import app from "./app";
async function start() {
	const isDev = process.env.NODE_ENV !== "production";

	const server = Fastify({
		logger: isDev
			? {
					transport: {
						target: "pino-pretty",
						options: {
							translateTime: "HH:MM:ss",
							ignore: "pid,hostname",
							colorize: true,
						},
					},
				}
			: true,
	});

	server.setValidatorCompiler(createValidatorCompiler());
	server.setSerializerCompiler(createSerializerCompiler());

	await server.register(app);

	await server.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
}

start();
