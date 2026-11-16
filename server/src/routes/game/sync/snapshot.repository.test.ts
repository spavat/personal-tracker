import { describe, expect, it, vi } from "vitest";

import { SnapshotRepository } from "./snapshot.repository";

describe("SnapshotRepository.deleteOlderThan", () => {
	it("keeps the store's latest successful snapshot, the next run's baseline", async () => {
		const findOne = vi.fn().mockResolvedValue({ id: "baseline" });
		const deleteMany = vi.fn();
		const repo = new SnapshotRepository({ db: { collection: () => ({ findOne, deleteMany }) } } as any);

		await repo.deleteOlderThan("epic", "2026-10-15T03:00:00Z");

		expect(findOne).toHaveBeenCalledWith(
			{ store: "epic", status: "ok" },
			expect.objectContaining({ sort: { fetchedAt: -1 } }),
		);
		expect(deleteMany).toHaveBeenCalledWith({
			store: "epic",
			fetchedAt: { $lt: "2026-10-15T03:00:00Z" },
			id: { $ne: "baseline" },
		});
	});
});
