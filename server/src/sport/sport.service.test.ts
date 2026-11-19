import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BadRequestError, NotFoundError } from "../common/errors.js";
import { SportFilesStorage } from "./sport-files.storage.js";
import { SportRepository } from "./sport.repository.js";
import { SportService } from "./sport.service.js";

// 60 points 30 m apart, 10 s apart: a real track, so extractGPXData and the thumbnail run for real
function gpxFile() {
	const points = Array.from(
		{ length: 60 },
		(_, i) =>
			`<trkpt lat="${45 + (i * 30) / 111_195}" lon="5.7"><time>${new Date(Date.parse("2024-06-01T10:00:00Z") + i * 10_000).toISOString()}</time></trkpt>`,
	);
	return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="test"><trk><trkseg>${points.join("")}</trkseg></trk></gpx>`;
}

const POINTS = [
	{ id: "pt-0", lat: 48.85, lon: 2.35, time: "2024-06-01T10:00:00.000Z", distanceFromStart: 0 },
	{ id: "pt-1", lat: 48.86, lon: 2.36, time: "2024-06-01T10:01:00.000Z", distanceFromStart: 1000 },
	{ id: "pt-2", lat: 48.87, lon: 2.37, time: "2024-06-01T10:02:00.000Z", distanceFromStart: 2000 },
];

describe("SportService", () => {
	let service: SportService;
	const repo = {
		findAll: vi.fn(),
		findById: vi.fn(),
		findForDownload: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	};
	const files = { uploadGpx: vi.fn(), gpxDownloadUrl: vi.fn(), uploadThumbnail: vi.fn(), delete: vi.fn() };

	beforeEach(async () => {
		vi.resetAllMocks();
		const ref = await Test.createTestingModule({
			providers: [
				SportService,
				{ provide: SportRepository, useValue: repo },
				{ provide: SportFilesStorage, useValue: files },
			],
		}).compile();
		service = ref.get(SportService);
	});

	describe("downloadUrl", () => {
		it("rejects with NotFoundError when the activity has no GPX file", async () => {
			repo.findForDownload.mockResolvedValue({ name: "Run" });
			await expect(service.downloadUrl("a1")).rejects.toBeInstanceOf(NotFoundError);
			expect(files.gpxDownloadUrl).not.toHaveBeenCalled();
		});

		it("signs a url from the stored key and the activity name", async () => {
			repo.findForDownload.mockResolvedValue({ gpxKey: "key/a1.gpx", name: "Morning run" });
			files.gpxDownloadUrl.mockResolvedValue("https://signed");

			expect(await service.downloadUrl("a1")).toBe("https://signed");
			expect(files.gpxDownloadUrl).toHaveBeenCalledWith("key/a1.gpx", "Morning run");
		});
	});

	describe("create / update", () => {
		const body = {
			name: "Morning run",
			type: "running",
			details: { totalDuration: 0, movingDuration: 0, distance: 0, pace: 0 },
		};

		it("updates the activity, removing a comment left out", async () => {
			repo.update.mockResolvedValue({ id: "a1" });
			await service.update("a1", body);
			expect(repo.update).toHaveBeenCalledWith("a1", body, ["comment"]);
			expect(repo.insert).not.toHaveBeenCalled();
		});

		it("keeps the comment sent on update", async () => {
			repo.update.mockResolvedValue({ id: "a1" });
			await service.update("a1", { ...body, comment: "Nice" });
			expect(repo.update).toHaveBeenCalledWith("a1", { ...body, comment: "Nice" }, []);
		});

		it("inserts a new activity with a generated id", async () => {
			await service.create({ ...body, date: "2024-06-01T10:00:00" });

			expect(repo.insert).toHaveBeenCalledWith({
				id: expect.any(String),
				created: expect.any(String),
				...body,
				date: "2024-06-01T10:00:00",
			});
		});

		it("refuses a new activity without date nor GPX file", async () => {
			await expect(service.create(body)).rejects.toBeInstanceOf(BadRequestError);
			expect(repo.insert).not.toHaveBeenCalled();
		});

		it("stores the GPX file and its thumbnail, and takes the date and details from the GPX", async () => {
			await service.create({ ...body, rawData: gpxFile() });

			const [gpxKey, rawData] = files.uploadGpx.mock.calls[0];
			expect(gpxKey).toMatch(/^personal-tracker\/sport\/2024\/2024-06-01-.+\.gpx$/);
			expect(rawData).toBe(gpxFile());
			expect(files.uploadThumbnail).toHaveBeenCalledWith(
				expect.stringMatching(/-thumbnail\.avif$/),
				expect.any(Buffer),
			);

			const inserted = repo.insert.mock.calls[0][0];
			expect(inserted).toMatchObject({ gpxKey, date: expect.stringMatching(/^2024-06-01T/) });
			expect(inserted.details.distance).toBeGreaterThan(1);
			expect(inserted.points.length).toBeGreaterThan(0);
			expect(inserted).not.toHaveProperty("rawData"); // the file lives in S3, not in Mongo
		});

		it("refuses a GPX file without a date, before storing anything", async () => {
			const noTime = gpxFile().replace(/<time>[^<]*<\/time>/g, "");
			await expect(service.create({ ...body, rawData: noTime })).rejects.toBeInstanceOf(BadRequestError);
			expect(files.uploadGpx).not.toHaveBeenCalled();
		});
	});

	describe("delete", () => {
		it("deletes the activity, then its GPX file and thumbnail", async () => {
			repo.delete.mockResolvedValue({ id: "a1", gpxKey: "g/a1.gpx", thumbnailKey: "t/a1.avif" });

			await service.delete("a1");
			expect(files.delete.mock.calls).toEqual([["g/a1.gpx"], ["t/a1.avif"]]);
		});

		it("leaves the storage alone when the activity has no files", async () => {
			repo.delete.mockResolvedValue({ id: "a1" });
			await service.delete("a1");
			expect(files.delete).not.toHaveBeenCalled();
		});

		it("rejects with NotFoundError for an unknown activity", async () => {
			repo.delete.mockResolvedValue(null);
			await expect(service.delete("a1")).rejects.toBeInstanceOf(NotFoundError);
		});
	});

	describe("crop", () => {
		it("rejects an endIndex out of bounds", async () => {
			repo.findById.mockResolvedValue({ points: POINTS });
			await expect(service.crop("a1", 0, 5)).rejects.toBeInstanceOf(BadRequestError);
		});

		it("rejects with NotFoundError for an unknown activity", async () => {
			repo.findById.mockResolvedValue(null);
			await expect(service.crop("a1", 0, 1)).rejects.toBeInstanceOf(NotFoundError);
		});

		it("saves the cropped range, without a thumbnail when there was none", async () => {
			repo.findById.mockResolvedValue({ points: POINTS });
			repo.update.mockResolvedValue({ id: "a1" });

			await service.crop("a1", 0, 1);

			expect(repo.update).toHaveBeenCalledWith(
				"a1",
				expect.objectContaining({ points: expect.any(Array), details: expect.any(Object), segments: [] }),
			);
			expect(files.uploadThumbnail).not.toHaveBeenCalled();
		});

		it("regenerates the thumbnail at its existing key", async () => {
			repo.findById.mockResolvedValue({ points: POINTS, thumbnailKey: "t/a1.avif" });
			repo.update.mockResolvedValue({ id: "a1" });

			await service.crop("a1", 0, 1);

			expect(files.uploadThumbnail).toHaveBeenCalledWith("t/a1.avif", expect.any(Buffer));
		});
	});

	it("updateSegments sorts the segments by time", async () => {
		repo.update.mockResolvedValue({ id: "a1" });
		await service.updateSegments("a1", [
			{ time: 80, type: "running" },
			{ time: 0, type: "running" },
			{ time: 60, type: "pause" },
		]);

		expect(repo.update).toHaveBeenCalledWith("a1", {
			segments: [
				{ time: 0, type: "running" },
				{ time: 60, type: "pause" },
				{ time: 80, type: "running" },
			],
		});
	});
});
