import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../common/errors.js";
import { LifespanObjectsRepository } from "./objects.repository.js";
import { LifespanObjectsService } from "./objects.service.js";

describe("LifespanObjectsService", () => {
	let service: LifespanObjectsService;
	const repo = {
		findAll: vi.fn(),
		findById: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		pushEvent: vi.fn(),
		updateEvent: vi.fn(),
		deleteEvent: vi.fn(),
	};

	beforeEach(async () => {
		vi.resetAllMocks();
		const ref = await Test.createTestingModule({
			providers: [LifespanObjectsService, { provide: LifespanObjectsRepository, useValue: repo }],
		}).compile();
		service = ref.get(LifespanObjectsService);
	});

	describe("list", () => {
		it("defaults sort to name asc and normalises a missing search to empty", () => {
			service.list({});
			expect(repo.findAll).toHaveBeenCalledWith({
				search: "",
				categoryId: undefined,
				sortField: "name",
				sortDirection: "asc",
			});
		});

		it("passes the requested sort, search and categoryId through", () => {
			service.list({ sort: ["usageStatus", "desc"], search: "phone", categoryId: "cat-1" } as never);
			expect(repo.findAll).toHaveBeenCalledWith({
				search: "phone",
				categoryId: "cat-1",
				sortField: "usageStatus",
				sortDirection: "desc",
			});
		});
	});

	describe("get", () => {
		it("returns the events sorted most-recent first", async () => {
			repo.findById.mockResolvedValue({
				id: "obj-1",
				name: "Phone",
				events: [{ date: "2024-01-01" }, { date: "2024-03-01" }],
			});

			expect(await service.get("obj-1")).toEqual({
				id: "obj-1",
				name: "Phone",
				events: [{ date: "2024-03-01" }, { date: "2024-01-01" }],
			});
		});

		it("rejects with NotFoundError when the object is missing", async () => {
			repo.findById.mockResolvedValue(null);
			await expect(service.get("nope")).rejects.toBeInstanceOf(NotFoundError);
		});
	});

	describe("save", () => {
		it("updates an existing object, removing a description left out", () => {
			const object = { id: "o1", name: "Phone", categoryId: "cat-1" };
			service.save({ object });
			expect(repo.update).toHaveBeenCalledWith("o1", object, ["description"]);
		});

		it("keeps the description sent on update", () => {
			const object = { id: "o1", name: "Phone", categoryId: "cat-1", description: "Mine" };
			service.save({ object });
			expect(repo.update).toHaveBeenCalledWith("o1", object, []);
		});

		it("replaces the events of an existing object, keeping created of known events", async () => {
			repo.findById.mockResolvedValue({
				id: "o1",
				events: [
					{ id: "e1", type: "bought", date: "2024-01-01", created: "2024-01-01T10:00:00" },
					{ id: "e2", type: "start_usage", date: "2024-01-02", created: "2024-01-02T10:00:00" },
				],
			});
			const object = { id: "o1", name: "Phone", categoryId: "cat-1" };

			await service.save({
				object,
				events: [
					{ id: "e1", type: "received", date: "2024-01-05" },
					{ type: "note", date: "2024-02-01", comment: "new" },
				],
			});

			const [id, saved] = repo.update.mock.calls[0];
			expect(id).toBe("o1");
			expect(saved).toMatchObject(object);
			expect(saved.events).toHaveLength(2); // e2 removed
			expect(saved.events[0]).toEqual({
				id: "e1",
				type: "received",
				date: "2024-01-05",
				created: "2024-01-01T10:00:00",
			});
			expect(saved.events[1]).toMatchObject({ type: "note", date: "2024-02-01", comment: "new" });
			expect(saved.events[1].id).not.toBe("e1");
			expect(saved.events[1].created).toEqual(expect.any(String));
		});

		it("builds an event with an unknown id as a new event", async () => {
			repo.findById.mockResolvedValue({ id: "o1", events: [] });

			await service.save({
				object: { id: "o1", name: "Phone", categoryId: "cat-1" },
				events: [{ id: "ghost", type: "note", date: "2024-02-01" }],
			});

			const saved = repo.update.mock.calls[0][1];
			expect(saved.events[0].id).not.toBe("ghost");
			expect(saved.events[0].created).toEqual(expect.any(String));
		});

		it("inserts a new object with a generated id and its initial events", () => {
			service.save({
				object: { name: "Phone", categoryId: "cat-1" },
				events: [
					{ type: "bought", date: "2024-06-01" },
					{ type: "start_usage", date: "2024-06-02" },
				],
			});

			const inserted = repo.insert.mock.calls[0][0];
			expect(inserted).toMatchObject({ name: "Phone", categoryId: "cat-1" });
			expect(inserted.id).toEqual(expect.any(String));
			expect(inserted.events.map((e: { type: string }) => e.type)).toEqual(["bought", "start_usage"]);
			expect(inserted.events[0].id).toEqual(expect.any(String));
		});

		it("inserts a new object with no events", () => {
			service.save({ object: { name: "Phone", categoryId: "cat-1" } });
			expect(repo.insert.mock.calls[0][0].events).toEqual([]);
		});

		it("updates an existing event, removing the optional fields left out", () => {
			const event = { id: "e1", type: "note" as const, date: "2024-06-01" };
			service.save({ objectId: "o1", event });
			expect(repo.updateEvent).toHaveBeenCalledWith("o1", event, ["cause", "comment"]);
		});

		it("pushes a freshly built event when the event has no id", () => {
			service.save({ objectId: "o1", event: { type: "note", date: "2024-06-01" } });

			const [objectId, built] = repo.pushEvent.mock.calls[0];
			expect(objectId).toBe("o1");
			expect(built).toMatchObject({ type: "note", date: "2024-06-01" });
			expect(built.id).toEqual(expect.any(String));
		});
	});

	it("deleteEvent / delete forward the ids", () => {
		service.deleteEvent("o1", "e1");
		service.delete("o1");
		expect(repo.deleteEvent).toHaveBeenCalledWith("o1", "e1");
		expect(repo.delete).toHaveBeenCalledWith("o1");
	});
});
