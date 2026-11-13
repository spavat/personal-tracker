import type { GameStore } from "@personal-tracker/shared/game";
import type { FastifyInstance } from "fastify";

const MONGO_GAME_SYNC_SNAPSHOT_COLLECTION = "game_sync_snapshot";

/**
 * One fetch of a store, raw response kept as-is. `import` snapshots are the baseline of the catch-up: the time
 * before them is in the catch-up play, so only `run` snapshots are diffed into plays.
 */
export interface Snapshot {
	id: string;
	store: GameStore;
	kind: "import" | "run";
	// ISO instant; `day` is its play day
	fetchedAt: string;
	day: string;
	status: "ok" | "error";
	raw?: unknown;
	error?: string;
}

export class SnapshotRepository {
	constructor(private mongo: FastifyInstance["mongo"]) {}

	private get collection() {
		return this.mongo?.db?.collection<Snapshot>(MONGO_GAME_SYNC_SNAPSHOT_COLLECTION);
	}

	insert(snapshot: Snapshot) {
		return this.collection?.insertOne({ ...snapshot });
	}

	/** The store's latest successful snapshot: the baseline of the next run. */
	async findLatestOk(store: GameStore): Promise<Snapshot | null> {
		return (
			(await this.collection?.findOne(
				{ store, status: "ok" },
				{ sort: { fetchedAt: -1 }, projection: { _id: 0 } },
			)) ?? null
		);
	}

	/** The store's successful snapshots, oldest first (replay). */
	async findOk(store: GameStore): Promise<Snapshot[]> {
		return (
			(await this.collection
				?.find({ store, status: "ok" }, { projection: { _id: 0 } })
				.sort({ fetchedAt: 1 })
				.toArray()) ?? []
		);
	}

	/** The store's snapshots without their raw response, most recent first (status page). */
	async findRecent(store: GameStore): Promise<Omit<Snapshot, "raw">[]> {
		return (
			(await this.collection
				?.find({ store }, { projection: { _id: 0, raw: 0 } })
				.sort({ fetchedAt: -1 })
				.toArray()) ?? []
		);
	}

	/** Most recent run of any store, an import doesn't count (has the 04:00 run been missed?). */
	async findLatestRun(): Promise<Omit<Snapshot, "raw"> | null> {
		return (
			(await this.collection?.findOne(
				{ kind: "run" },
				{ sort: { fetchedAt: -1 }, projection: { _id: 0, raw: 0 } },
			)) ?? null
		);
	}

	/** Snapshots fetched before `before`, except the store's latest successful one (still the baseline). */
	async deleteOlderThan(store: GameStore, before: string) {
		const baseline = await this.findLatestOk(store);
		return this.collection?.deleteMany({
			store,
			fetchedAt: { $lt: before },
			...(baseline ? { id: { $ne: baseline.id } } : {}),
		});
	}
}
