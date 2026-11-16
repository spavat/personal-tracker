import "@fastify/mongodb";
import fp from "fastify-plugin";

import { buildSyncContext } from "../routes/game/sync/sync-context";
import { isRunDue, nextRunSlot } from "../routes/game/sync/sync.entity";
import { RunDailySyncUseCase } from "../routes/game/sync/sync.useCases";

/**
 * Daily store playtime sync at 04:00 Europe/Paris, inside the server. When the server was down at 04:00, the run
 * starts as soon as it is ready. GAME_SYNC_SCHEDULER=off disables it (tests).
 */
export default fp(async (fastify) => {
	if (process.env.GAME_SYNC_SCHEDULER === "off") return;

	const { connectors, games, snapshots, enrichment } = buildSyncContext(fastify.mongo);
	const runSync = new RunDailySyncUseCase(connectors, games, snapshots, { enrichment });
	const log = fastify.log.child({ job: "game-store-sync" });
	let timer: NodeJS.Timeout | undefined;

	async function run() {
		try {
			const results = await runSync.execute(undefined, log);
			log.info({ results }, "game sync: daily run done");
		} catch (error) {
			log.error({ error }, "game sync: daily run failed");
		}
	}

	function scheduleNext() {
		const now = Temporal.Now.instant();
		const delay = now.until(nextRunSlot(now)).total("milliseconds");
		timer = setTimeout(() => void run().finally(scheduleNext), delay);
		// the pending run must not keep the process alive on shutdown
		timer.unref();
	}

	fastify.addHook("onReady", async () => {
		const latest = await snapshots.findLatestRun().catch(() => null);
		if (isRunDue(Temporal.Now.instant(), latest?.fetchedAt)) {
			// not awaited: the server starts without waiting for the stores
			void run();
		}
		scheduleNext();
	});

	fastify.addHook("onClose", async () => {
		clearTimeout(timer);
	});
});
