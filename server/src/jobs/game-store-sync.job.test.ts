import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RunDailySyncUseCase } from "../routes/game/sync/sync.useCases";
import { makeFakeMongo } from "../test-support/fake-mongo";
import { buildRouteApp } from "../test-support/route-harness";
import scheduler from "./game-store-sync.job";

vi.mock("../config/game-stores", () => ({ STEAM_API_KEY: "", STEAM_ID: "", GOG_USERNAME: "" }));

let snapshotFindOne: ReturnType<typeof vi.fn>;

async function start(latestFetchedAt?: string) {
	const { mongo, collection } = makeFakeMongo();
	snapshotFindOne = collection("game_sync_snapshot").findOne;
	snapshotFindOne.mockResolvedValue(latestFetchedAt ? { fetchedAt: latestFetchedAt } : null);
	return buildRouteApp(scheduler, { mongo });
}

describe("game sync scheduler", () => {
	let execute: ReturnType<typeof vi.spyOn>;
	let setTimeoutSpy: ReturnType<typeof vi.spyOn>;
	let app: Awaited<ReturnType<typeof start>> | undefined;

	beforeEach(() => {
		execute = vi.spyOn(RunDailySyncUseCase.prototype, "execute").mockResolvedValue([]);
		setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
	});
	afterEach(async () => {
		await app?.close();
		app = undefined;
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("runs at startup when the 04:00 run was missed, then schedules the next one", async () => {
		app = await start("2020-01-01T03:00:00Z");

		expect(execute).toHaveBeenCalledTimes(1);
		// an import made after a missed 04:00 doesn't count as that day's run
		expect(snapshotFindOne.mock.calls[0][0]).toEqual({ kind: "run" });
		const delays = setTimeoutSpy.mock.calls.map((call: unknown[]) => call[1] as number);
		expect(delays.some((delay: number) => delay > 0 && delay <= 25 * 3600 * 1000)).toBe(true);
	});

	it("only schedules when a fetch happened since the latest slot", async () => {
		app = await start(Temporal.Now.instant().toString());
		expect(execute).not.toHaveBeenCalled();
	});

	it("is off with GAME_SYNC_SCHEDULER=off", async () => {
		vi.stubEnv("GAME_SYNC_SCHEDULER", "off");
		app = await start();
		expect(execute).not.toHaveBeenCalled();
	});
});
