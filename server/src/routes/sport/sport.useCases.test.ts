import { describe, expect, it, vi } from "vitest";

import type { GpxStorageRepository } from "./gpx-storage.repository";
import type { SportRepository } from "./sport.repository";
import type { ThumbnailStorageRepository } from "./thumbnail-storage.repository";

import { asLog, makeLog } from "../../test-support/fake-log";
import {
	CropActivityUseCase,
	DeleteActivityUseCase,
	DownloadActivityUseCase,
	GetActivityUseCase,
	ListActivitiesUseCase,
	SaveActivityUseCase,
	UpdateSegmentsUseCase,
} from "./sport.useCases";

function fakeRepo() {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn().mockResolvedValue(null),
		findForDownload: vi.fn().mockResolvedValue(null),
		findThumbnailKey: vi.fn().mockResolvedValue(null),
		insert: vi.fn().mockResolvedValue({ acknowledged: true }),
		update: vi.fn().mockResolvedValue({ acknowledged: true }),
		delete: vi.fn().mockResolvedValue(null),
	};
}
function fakeGpxStorage() {
	return {
		upload: vi.fn().mockResolvedValue(undefined),
		getDownloadUrl: vi.fn().mockResolvedValue("https://signed"),
		delete: vi.fn().mockResolvedValue(undefined),
	};
}
function fakeThumbStorage() {
	return { upload: vi.fn(), getObject: vi.fn(), delete: vi.fn().mockResolvedValue(undefined) };
}

const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as SportRepository;
const asGpx = (r: ReturnType<typeof fakeGpxStorage>) => r as unknown as GpxStorageRepository;
const asThumb = (r: ReturnType<typeof fakeThumbStorage>) => r as unknown as ThumbnailStorageRepository;

describe("ListActivitiesUseCase / GetActivityUseCase", () => {
	it("delegate to the repository", () => {
		const repo = fakeRepo();
		new ListActivitiesUseCase(asRepo(repo)).execute({ from: "2024-01-01", to: "2024-12-31" }, asLog(makeLog()));
		new GetActivityUseCase(asRepo(repo)).execute("a1", asLog(makeLog()));
		expect(repo.findAll).toHaveBeenCalledWith({ from: "2024-01-01", to: "2024-12-31" });
		expect(repo.findById).toHaveBeenCalledWith("a1");
	});
});

describe("DownloadActivityUseCase", () => {
	it("returns null when the activity has no gpx key", async () => {
		const repo = fakeRepo();
		const gpx = fakeGpxStorage();
		expect(await new DownloadActivityUseCase(asRepo(repo), asGpx(gpx)).execute("a1", asLog(makeLog()))).toBeNull();
		expect(gpx.getDownloadUrl).not.toHaveBeenCalled();
	});

	it("returns a signed url built from the stored key and name", async () => {
		const repo = fakeRepo();
		repo.findForDownload.mockResolvedValue({ gpxKey: "key/a1.gpx", name: "Morning run" });
		const gpx = fakeGpxStorage();

		const url = await new DownloadActivityUseCase(asRepo(repo), asGpx(gpx)).execute("a1", asLog(makeLog()));

		expect(url).toBe("https://signed");
		expect(gpx.getDownloadUrl).toHaveBeenCalledWith("key/a1.gpx", "Morning run");
	});
});

describe("SaveActivityUseCase", () => {
	const body = { name: "Morning run", type: "run" };

	it("updates the activity when an id is given", async () => {
		const repo = fakeRepo();
		const useCase = new SaveActivityUseCase(asRepo(repo), asGpx(fakeGpxStorage()), asThumb(fakeThumbStorage()));

		await useCase.execute({ id: "a1", ...body } as any, asLog(makeLog()));

		expect(repo.update).toHaveBeenCalledWith("a1", body, ["comment"]);
		expect(repo.insert).not.toHaveBeenCalled();
	});

	it("keeps the comment sent on update", async () => {
		const repo = fakeRepo();
		const useCase = new SaveActivityUseCase(asRepo(repo), asGpx(fakeGpxStorage()), asThumb(fakeThumbStorage()));

		await useCase.execute({ id: "a1", ...body, comment: "Nice" } as any, asLog(makeLog()));

		expect(repo.update).toHaveBeenCalledWith("a1", { ...body, comment: "Nice" }, []);
	});

	it("inserts a new activity with a generated id when no id is given", async () => {
		const repo = fakeRepo();
		const useCase = new SaveActivityUseCase(asRepo(repo), asGpx(fakeGpxStorage()), asThumb(fakeThumbStorage()));

		await useCase.execute({ ...body, date: "2024-06-01T10:00:00" } as any, asLog(makeLog()));

		expect(repo.insert).toHaveBeenCalledWith({
			id: expect.any(String),
			created: expect.any(String),
			...body,
			date: "2024-06-01T10:00:00",
		});
		expect(repo.update).not.toHaveBeenCalled();
	});

	it("refuses a new activity without date nor GPX file", async () => {
		const repo = fakeRepo();
		const useCase = new SaveActivityUseCase(asRepo(repo), asGpx(fakeGpxStorage()), asThumb(fakeThumbStorage()));

		await expect(useCase.execute(body as any, asLog(makeLog()))).rejects.toThrow("No date");
		expect(repo.insert).not.toHaveBeenCalled();
	});
});

describe("DeleteActivityUseCase", () => {
	it("deletes the activity and leaves storage alone when there are no keys", async () => {
		const repo = fakeRepo();
		repo.delete.mockResolvedValue({ id: "a1" });
		const gpx = fakeGpxStorage();
		const thumb = fakeThumbStorage();

		const res = await new DeleteActivityUseCase(asRepo(repo), asGpx(gpx), asThumb(thumb)).execute(
			"a1",
			asLog(makeLog()),
		);

		expect(repo.delete).toHaveBeenCalledWith("a1");
		expect(gpx.delete).not.toHaveBeenCalled();
		expect(thumb.delete).not.toHaveBeenCalled();
		expect(res).toEqual({ id: "a1" });
	});

	it("also removes the gpx and thumbnail objects when the deleted activity had keys", async () => {
		const repo = fakeRepo();
		repo.delete.mockResolvedValue({ id: "a1", gpxKey: "g/a1.gpx", thumbnailKey: "t/a1.png" });
		const gpx = fakeGpxStorage();
		const thumb = fakeThumbStorage();

		await new DeleteActivityUseCase(asRepo(repo), asGpx(gpx), asThumb(thumb)).execute("a1", asLog(makeLog()));

		expect(gpx.delete).toHaveBeenCalledWith("g/a1.gpx");
		expect(thumb.delete).toHaveBeenCalledWith("t/a1.png");
	});
});

describe("CropActivityUseCase", () => {
	const points = [
		{ id: "pt-0", lat: 48.85, lon: 2.35, time: "2024-06-01T10:00:00.000Z", distanceFromStart: 0 },
		{ id: "pt-1", lat: 48.86, lon: 2.36, time: "2024-06-01T10:01:00.000Z", distanceFromStart: 1000 },
		{ id: "pt-2", lat: 48.87, lon: 2.37, time: "2024-06-01T10:02:00.000Z", distanceFromStart: 2000 },
	];

	it("throws when endIndex is out of bounds", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({ points });

		const useCase = new CropActivityUseCase(asRepo(repo), asThumb(fakeThumbStorage()));

		await expect(useCase.execute("a1", 0, 5, asLog(makeLog()))).rejects.toThrow("endIndex is out of bounds");
	});

	it("saves the cropped points/details/segments and leaves the thumbnail alone when there is none", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({ points });
		const thumb = fakeThumbStorage();

		await new CropActivityUseCase(asRepo(repo), asThumb(thumb)).execute("a1", 0, 1, asLog(makeLog()));

		expect(repo.update).toHaveBeenCalledWith(
			"a1",
			expect.objectContaining({ points: expect.any(Array), details: expect.any(Object), segments: [] }),
		);
		expect(thumb.upload).not.toHaveBeenCalled();
	});

	it("regenerates the thumbnail at its existing key when the activity has one", async () => {
		const repo = fakeRepo();
		repo.findById.mockResolvedValue({ points, thumbnailKey: "t/a1.avif" });
		const thumb = fakeThumbStorage();

		await new CropActivityUseCase(asRepo(repo), asThumb(thumb)).execute("a1", 0, 1, asLog(makeLog()));

		expect(thumb.upload).toHaveBeenCalledWith("t/a1.avif", expect.any(Buffer));
	});
});

describe("UpdateSegmentsUseCase", () => {
	it("sorts segments by time before saving", async () => {
		const repo = fakeRepo();

		await new UpdateSegmentsUseCase(asRepo(repo)).execute(
			{
				id: "a1",
				segments: [
					{ time: 80, type: "running" },
					{ time: 0, type: "running" },
					{ time: 60, type: "pause" },
				],
			},
			asLog(makeLog()),
		);

		expect(repo.update).toHaveBeenCalledWith("a1", {
			segments: [
				{ time: 0, type: "running" },
				{ time: 60, type: "pause" },
				{ time: 80, type: "running" },
			],
		});
	});
});
