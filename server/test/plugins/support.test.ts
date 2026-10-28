import Fastify from "fastify";
import * as assert from "node:assert";
import { test } from "node:test";

import Support from "../../src/plugins/support";

test("support works standalone", async () => {
	const fastify = Fastify();
	// eslint-disable-next-line no-void
	void fastify.register(Support);
	await fastify.ready();

	assert.equal(fastify.someSupport(), "hugs");
});
