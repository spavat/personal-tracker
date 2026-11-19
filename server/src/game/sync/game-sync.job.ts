import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";

import { Env } from "../../config/env.schema.js";
import { GameSyncService } from "./game-sync.service.js";
import { SnapshotRepository } from "./snapshot.repository.js";
import { isRunDue } from "./sync.entity.js";

/**
 * Daily store playtime sync at 04:00 Europe/Paris, inside the server (@nestjs/schedule). When the server was down
 * at 04:00, the run starts at startup. GAME_SYNC_SCHEDULER=off disables both (the /game/sync routes still work).
 */
@Injectable()
export class GameSyncJob implements OnApplicationBootstrap {
	private readonly logger = new Logger(GameSyncJob.name);
	private readonly enabled: boolean;

	constructor(
		private readonly sync: GameSyncService,
		private readonly snapshots: SnapshotRepository,
		config: ConfigService<Env, true>,
	) {
		this.enabled = config.get("GAME_SYNC_SCHEDULER", { infer: true }) !== "off";
	}

	// Catch-up of a missed 04:00 run; not awaited: the server starts without waiting for the stores
	async onApplicationBootstrap() {
		if (!this.enabled) return;
		const latest = await this.snapshots.findLatestRun().catch(() => null);
		if (isRunDue(Temporal.Now.instant(), latest?.fetchedAt)) {
			this.logger.log("the 04:00 run was missed: running now");
			void this.run();
		}
	}

	@Cron("0 4 * * *", { name: "game-store-sync", timeZone: "Europe/Paris" })
	async daily() {
		if (this.enabled) await this.run();
	}

	// A failing run is logged, never thrown: the scheduler and the startup keep going
	private async run() {
		try {
			const results = await this.sync.run();
			this.logger.log(`daily run done: ${JSON.stringify(results)}`);
		} catch (error) {
			this.logger.error(`daily run failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
