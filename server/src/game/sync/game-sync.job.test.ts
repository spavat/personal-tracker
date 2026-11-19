import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { GameSyncJob } from "./game-sync.job.js";
import { GameSyncService } from "./game-sync.service.js";
import { SnapshotRepository } from "./snapshot.repository.js";

async function build({ latestRunAt, scheduler = "on" }: { latestRunAt?: string; scheduler?: "on" | "off" }) {
	const sync = { run: vi.fn().mockResolvedValue([]) };
	const snapshots = { findLatestRun: vi.fn().mockResolvedValue(latestRunAt ? { fetchedAt: latestRunAt } : null) };
	const ref = await Test.createTestingModule({
		providers: [
			GameSyncJob,
			{ provide: GameSyncService, useValue: sync },
			{ provide: SnapshotRepository, useValue: snapshots },
			{ provide: ConfigService, useValue: { get: () => scheduler } },
		],
	}).compile();
	return { job: ref.get(GameSyncJob), sync, snapshots };
}

describe("GameSyncJob", () => {
	it("runs at startup when the 04:00 run was missed", async () => {
		const { job, sync, snapshots } = await build({ latestRunAt: "2020-01-01T03:00:00Z" });

		await job.onApplicationBootstrap();

		expect(snapshots.findLatestRun).toHaveBeenCalled();
		expect(sync.run).toHaveBeenCalledTimes(1);
	});

	it("doesn't run at startup when a run happened since the latest 04:00", async () => {
		const { job, sync } = await build({ latestRunAt: Temporal.Now.instant().toString() });

		await job.onApplicationBootstrap();

		expect(sync.run).not.toHaveBeenCalled();
	});

	it("runs every store at the 04:00 tick, and never throws", async () => {
		const { job, sync } = await build({});
		sync.run.mockRejectedValueOnce(new Error("Steam down"));

		await expect(job.daily()).resolves.toBeUndefined();
		expect(sync.run).toHaveBeenCalledWith();
	});

	it("does nothing with GAME_SYNC_SCHEDULER=off", async () => {
		const { job, sync } = await build({ scheduler: "off" });

		await job.onApplicationBootstrap();
		await job.daily();

		expect(sync.run).not.toHaveBeenCalled();
	});
});
