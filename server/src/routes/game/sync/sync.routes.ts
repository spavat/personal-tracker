import type { FastifyPluginAsync } from "fastify";

// Store playtime sync (/game/sync): routes come with the sync use cases. The file is needed now so that
// autoload treats this folder as a route plugin instead of registering every file in it.
const sync: FastifyPluginAsync = async (): Promise<void> => {};

export default sync;
