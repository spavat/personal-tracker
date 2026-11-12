import fp from "fastify-plugin";

import {
	ENABLE_BANKING_API_URL,
	ENABLE_BANKING_APP_ID,
	ENABLE_BANKING_ENABLED,
	ENABLE_BANKING_KEY_PATH,
} from "../config/enable-banking";
import { BankingRepository } from "../routes/money/banking/banking.repository";
import { SyncUseCase } from "../routes/money/banking/banking.useCases";
import { EnableBankingClient } from "../routes/money/banking/enable-banking.client";

// how often we check whether a connection needs its daily sync
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Daily bank sync: checked at startup (catch-up after a downtime) then every hour */
export default fp(async (fastify) => {
	if (!ENABLE_BANKING_ENABLED || process.env.NODE_ENV === "test") {
		fastify.log.info("bank sync scheduler disabled (no Enable Banking configuration)");
		return;
	}
	const log = fastify.log.child({ job: "bank-sync" });
	let timer: NodeJS.Timeout | undefined;

	// onReady: `fastify.db` is decorated by the drizzle plugin, which may load after this one
	fastify.addHook("onReady", async () => {
		const client = new EnableBankingClient({
			appId: ENABLE_BANKING_APP_ID,
			keyPath: ENABLE_BANKING_KEY_PATH,
			apiUrl: ENABLE_BANKING_API_URL,
		});
		const sync = new SyncUseCase(new BankingRepository(fastify.db), client);
		const run = () => {
			sync.execute({ force: false }, log).catch((err) => log.error({ err }, "bank sync failed"));
		};
		run();
		timer = setInterval(run, CHECK_INTERVAL_MS);
	});
	fastify.addHook("onClose", async () => clearInterval(timer));
});
