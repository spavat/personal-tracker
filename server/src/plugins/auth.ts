import { fromNodeHeaders } from "better-auth/node";
import fp from "fastify-plugin";

import { auth } from "../auth";

// Default deny: the owner (any logged-in session) can do everything,
// anonymous visitors only reach GET routes declared with `config: { public: true }`.
export default fp(async (fastify) => {
	fastify.decorateRequest("isOwner", false);

	fastify.addHook("onRequest", async (request, reply) => {
		if (request.method === "OPTIONS" || request.url.startsWith(`${auth.options.basePath}/`)) {
			return;
		}

		const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
		request.isOwner = session !== null;

		const isRead = request.method === "GET" || request.method === "HEAD";
		if (request.isOwner || (isRead && request.routeOptions.config?.public)) {
			return;
		}
		return reply.unauthorized();
	});

	// BetterAuth speaks Fetch Request/Response: rebuild one from the fastify request
	fastify.route({
		method: ["GET", "POST"],
		url: `${auth.options.basePath}/*`,
		async handler(request, reply) {
			const response = await auth.handler(
				new Request(new URL(request.url, auth.options.baseURL), {
					method: request.method,
					headers: fromNodeHeaders(request.headers),
					body: request.body ? JSON.stringify(request.body) : undefined,
				}),
			);

			reply.status(response.status);
			response.headers.forEach((value, key) => reply.header(key, value));
			return reply.send(response.body ? await response.text() : null);
		},
	});
});
