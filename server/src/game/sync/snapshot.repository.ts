import type { GameStore } from "@personal-tracker/shared/game";

import { Inject, Injectable } from "@nestjs/common";
import { Db } from "mongodb";

import { MONGO_DB } from "../../database/database.tokens.js";

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

@Injectable()
export class SnapshotRepository {
	constructor(@Inject(MONGO_DB) private readonly db: Db) {}

	private get collection() {
		return this.db.collection<Snapshot>("game_sync_snapshot");
	}

	insert(snapshot: Snapshot) {
		return this.collection.insertOne({ ...snapshot });
	}

	/** The store's latest successful snapshot: the baseline of the next run. */
	findLatestOk(store: GameStore): Promise<Snapshot | null> {
		return this.collection.findOne({ store, status: "ok" }, { sort: { fetchedAt: -1 }, projection: { _id: 0 } });
	}

	/** The store's successful snapshots, oldest first (replay). */
	findOk(store: GameStore): Promise<Snapshot[]> {
		return this.collection
			.find({ store, status: "ok" }, { projection: { _id: 0 } })
			.sort({ fetchedAt: 1 })
			.toArray();
	}

	/** The store's snapshots without their raw response, most recent first (status page). */
	findRecent(store: GameStore): Promise<Omit<Snapshot, "raw">[]> {
		return this.collection
			.find({ store }, { projection: { _id: 0, raw: 0 } })
			.sort({ fetchedAt: -1 })
			.toArray();
	}

	/** Most recent run of any store, an import doesn't count (has the 04:00 run been missed?). */
	findLatestRun(): Promise<Omit<Snapshot, "raw"> | null> {
		return this.collection.findOne({ kind: "run" }, { sort: { fetchedAt: -1 }, projection: { _id: 0, raw: 0 } });
	}

	/** Snapshots fetched before `before`, except the store's latest successful one (still the baseline). */
	async deleteOlderThan(store: GameStore, before: string) {
		const baseline = await this.findLatestOk(store);
		return this.collection.deleteMany({
			store,
			fetchedAt: { $lt: before },
			...(baseline ? { id: { $ne: baseline.id } } : {}),
		});
	}
}
