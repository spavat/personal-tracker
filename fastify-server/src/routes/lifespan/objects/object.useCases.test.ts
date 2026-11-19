import { describe, expect, it, vi } from "vitest";

import type { LifespanObjectRepository } from "./object.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import {
	DeleteLifespanEventUseCase,
	DeleteLifespanObjectUseCase,
	GetLifespanObjectUseCase,
	ListLifespanObjectsUseCase,
	SaveLifespanObjectUseCase,
} from "./object.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		insert: vi.fn().mockResolvedValue({ acknowledged: true }),
		update: vi.fn().mockResolvedValue({ acknowledged: true }),
		delete: vi.fn().mockResolvedValue({ acknowledged: true }),
		pushEvent: vi.fn().mockResolvedValue({ acknowledged: true }),
		updateEvent: vi.fn().mockResolvedValue({ acknowledged: true }),
		deleteEvent: vi.fn().mockResolvedValue({ acknowledged: true }),
	};
}

const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as LifespanObjectRepository;

describe("ListLifespanObjectsUseCase", () => {
	it("defaults sort to name asc and normalises a missing search to empty", () => {
		const repo = fakeRepo();
		new ListLifespanObjectsUseCase(asRepo(repo)).execute({} as any, asLog(makeLog()));
		expect(repo.findAll).toHaveBeenCalledWith({
			search: "",
			categoryId: undefined,
			sortField: "name",
			sortDirection: "asc",
		});
	});

	it("passes the requested sort, search and categoryId through", () => {
		const repo = fakeRepo();
		new ListLifespanObjectsUseCase(asRepo(repo)).execute(
			{
				sort: ["usageStatus", "desc"],
				search: "phone",
				categoryId: "cat-1",
			} as any,
			asLog(makeLog()),
		);
		expect(repo.findAll).toHaveBeenCalledWith({
			search: "phone",
			categoryId: "cat-1",
			sortField: "usageStatus",
			sortDirection: "desc",
		});
	});
});

describe("GetLifespanObjectUseCase", () => {
	it("strips _id and returns events sorted most-recent first", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({
			_id: "mongo-id",
			id: "obj-1",
			name: "Phone",
			events: [{ date: "2024-01-01" }, { date: "2024-03-01" }],
		});

		const result = await new GetLifespanObjectUseCase(asRepo(repo)).execute("obj-1", asLog(makeLog()));

		expect(result).toEqual({
			id: "obj-1",
			name: "Phone",
			events: [{ date: "2024-03-01" }, { date: "2024-01-01" }],
		});
	});

	it("returns null when the object is missing", async () => {
		const repo = fakeRepo();
		expect(await new GetLifespanObjectUseCase(asRepo(repo)).execute("nope", asLog(makeLog()))).toBeNull();
	});
});

describe("SaveLifespanObjectUseCase", () => {
	it("throws when both objectId and object.id are provided", () => {
		const repo = fakeRepo();
		expect(() =>
			new SaveLifespanObjectUseCase(asRepo(repo)).execute(
				{
					objectId: "o1",
					object: { id: "o1", name: "X", categoryId: "cat-1" },
				} as any,
				asLog(makeLog()),
			),
		).toThrow("Cannot provide both objectId and object.id");
	});

	it("updates an existing object", () => {
		const repo = fakeRepo();
		const object = { id: "o1", name: "Phone", categoryId: "cat-1" };
		new SaveLifespanObjectUseCase(asRepo(repo)).execute({ object } as any, asLog(makeLog()));

		expect(repo.update).toHaveBeenCalledWith("o1", object, ["description"]);
	});

	it("keeps the description sent on update", () => {
		const repo = fakeRepo();
		const object = { id: "o1", name: "Phone", categoryId: "cat-1", description: "Mine" };
		new SaveLifespanObjectUseCase(asRepo(repo)).execute({ object } as any, asLog(makeLog()));

		expect(repo.update).toHaveBeenCalledWith("o1", object, []);
	});

	it("replaces the events of an existing object, keeping created of known events", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({
			id: "o1",
			events: [
				{ id: "e1", type: "bought", date: "2024-01-01", created: "2024-01-01T10:00:00" },
				{ id: "e2", type: "start_usage", date: "2024-01-02", created: "2024-01-02T10:00:00" },
			],
		});
		const object = { id: "o1", name: "Phone", categoryId: "cat-1" };

		await new SaveLifespanObjectUseCase(asRepo(repo)).execute(
			{
				object,
				events: [
					{ id: "e1", type: "received", date: "2024-01-05" },
					{ type: "note", date: "2024-02-01", comment: "new" },
				],
			} as any,
			asLog(makeLog()),
		);

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
		expect(saved.events[1].id).toEqual(expect.any(String));
		expect(saved.events[1].id).not.toBe("e1");
		expect(saved.events[1].created).toEqual(expect.any(String));
	});

	it("builds an event with an unknown id as a new event", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({ id: "o1", events: [] });

		await new SaveLifespanObjectUseCase(asRepo(repo)).execute(
			{
				object: { id: "o1", name: "Phone", categoryId: "cat-1" },
				events: [{ id: "ghost", type: "note", date: "2024-02-01" }],
			} as any,
			asLog(makeLog()),
		);

		const saved = repo.update.mock.calls[0][1];
		expect(saved.events[0].id).not.toBe("ghost");
		expect(saved.events[0].created).toEqual(expect.any(String));
	});

	it("inserts a new object with a generated id and no events", () => {
		const repo = fakeRepo();
		new SaveLifespanObjectUseCase(asRepo(repo)).execute(
			{
				object: { name: "Phone", categoryId: "cat-1" },
			} as any,
			asLog(makeLog()),
		);

		expect(repo.insert).toHaveBeenCalledTimes(1);
		const inserted = repo.insert.mock.calls[0][0];
		expect(inserted).toMatchObject({ name: "Phone", categoryId: "cat-1", events: [] });
		expect(inserted.id).toEqual(expect.any(String));
	});

	it("inserts a new object with initial events", () => {
		const repo = fakeRepo();
		new SaveLifespanObjectUseCase(asRepo(repo)).execute(
			{
				object: { name: "Phone", categoryId: "cat-1" },
				events: [
					{ type: "bought", date: "2024-06-01" },
					{ type: "start_usage", date: "2024-06-02" },
				],
			} as any,
			asLog(makeLog()),
		);

		const inserted = repo.insert.mock.calls[0][0];
		expect(inserted.events).toHaveLength(2);
		expect(inserted.events[0]).toMatchObject({ type: "bought", date: "2024-06-01" });
		expect(inserted.events[1]).toMatchObject({ type: "start_usage", date: "2024-06-02" });
		expect(inserted.events[0].id).toEqual(expect.any(String));
	});

	it("updates an existing event when the event carries an id", () => {
		const repo = fakeRepo();
		const event = { id: "e1", type: "note", date: "2024-06-01" };
		new SaveLifespanObjectUseCase(asRepo(repo)).execute({ objectId: "o1", event } as any, asLog(makeLog()));
		expect(repo.updateEvent).toHaveBeenCalledWith("o1", event, ["cause", "comment"]);
	});

	it("pushes a freshly built event when the event has no id", () => {
		const repo = fakeRepo();
		new SaveLifespanObjectUseCase(asRepo(repo)).execute(
			{
				objectId: "o1",
				event: { type: "note", date: "2024-06-01" },
			} as any,
			asLog(makeLog()),
		);

		expect(repo.pushEvent).toHaveBeenCalledTimes(1);
		const [objectId, built] = repo.pushEvent.mock.calls[0];
		expect(objectId).toBe("o1");
		expect(built).toMatchObject({ type: "note", date: "2024-06-01" });
		expect(built.id).toEqual(expect.any(String));
	});

	it("returns a no-op result when there is nothing to do", () => {
		const repo = fakeRepo();
		expect(new SaveLifespanObjectUseCase(asRepo(repo)).execute({} as any, asLog(makeLog()))).toEqual({
			error: "Nothing to do",
		});
	});
});

describe("DeleteLifespanEventUseCase", () => {
	it("deletes the event by object and event id", () => {
		const repo = fakeRepo();
		new DeleteLifespanEventUseCase(asRepo(repo)).execute(
			{
				objectId: "o1",
				eventId: "e1",
			} as any,
			asLog(makeLog()),
		);
		expect(repo.deleteEvent).toHaveBeenCalledWith("o1", "e1");
	});

	it("throws when a required id is missing", () => {
		const repo = fakeRepo();
		expect(() =>
			new DeleteLifespanEventUseCase(asRepo(repo)).execute({ objectId: "o1" } as any, asLog(makeLog())),
		).toThrow("Both eventId and objectId are required");
	});
});

describe("DeleteLifespanObjectUseCase", () => {
	it("deletes the object by id", () => {
		const repo = fakeRepo();
		new DeleteLifespanObjectUseCase(asRepo(repo)).execute("o1", asLog(makeLog()));
		expect(repo.delete).toHaveBeenCalledWith("o1");
	});
});
