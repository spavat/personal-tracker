import { describe, expect, it, vi } from "vitest";

import type { MediaStorageRepository } from "./media-storage.repository";
import type { MediaRepository } from "./media.repository";

import { asLog, makeLog } from "../../../test-support/fake-log";
import { sortByMediaOrder } from "./media.entity";
import {
	DeleteMediaUseCase,
	ListMediaUseCase,
	ReorderMediaUseCase,
	UpdateMediaUseCase,
	UploadMediaUseCase,
} from "./media.useCases";

const TX = { tx: true };
const MEDIA_ID = "0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e";
const OTHER_ID = "7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

function fakeRepo() {
	return {
		runInTransaction: vi.fn((fn: (tx: unknown) => unknown) => fn(TX)),
		findKey: vi.fn(),
		findSpectacleMedia: vi
			.fn()
			.mockResolvedValue([
				{ kind: "poster", media: { id: MEDIA_ID, key: "k", label: "S1", contentType: "image/avif" } },
			]),
		findArtistMedia: vi
			.fn()
			.mockResolvedValue([
				{ spectacleId: null, media: { id: OTHER_ID, key: "k", label: "", contentType: "image/avif" } },
			]),
		linkExists: vi.fn().mockResolvedValue(true),
		findMediaIds: vi.fn().mockResolvedValue([MEDIA_ID, OTHER_ID]),
		nextOrder: vi.fn().mockResolvedValue(3),
		setOrder: vi.fn(),
		insertMedia: vi.fn().mockResolvedValue([{ id: MEDIA_ID }]),
		setFile: vi.fn(),
		updateLabel: vi.fn(),
		insertLink: vi.fn(),
		updateArtistLink: vi.fn(),
		deleteLink: vi.fn().mockResolvedValue([{ mediaId: MEDIA_ID }]),
		countLinks: vi.fn().mockResolvedValue(0),
		deleteMedia: vi
			.fn()
			.mockResolvedValue([{ key: "personal-tracker/show/media/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e.avif" }]),
	};
}
function fakeStorage() {
	return {
		uploadFromSource: vi.fn().mockResolvedValue({
			key: "personal-tracker/show/media/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e.avif",
			contentType: "image/avif",
		}),
		deleteObject: vi.fn().mockResolvedValue(undefined),
	};
}
const asRepo = (r: ReturnType<typeof fakeRepo>) => r as unknown as MediaRepository;
const asStorage = (s: ReturnType<typeof fakeStorage>) => s as unknown as MediaStorageRepository;

describe("ListMediaUseCase", () => {
	it("lists a spectacle's media of one kind", async () => {
		const repo = fakeRepo();
		expect(
			await new ListMediaUseCase(asRepo(repo)).execute({ spectacleId: 7 }, "poster", asLog(makeLog())),
		).toEqual([
			{
				id: MEDIA_ID,
				label: "S1",
				contentType: "image/avif",
				url: "/images/show/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e",
				kind: "poster",
			},
		]);
		expect(repo.findSpectacleMedia).toHaveBeenCalledWith(7, "poster");
	});

	it("lists an artist's media", async () => {
		const repo = fakeRepo();
		expect(await new ListMediaUseCase(asRepo(repo)).execute({ artistId: 3 }, undefined, asLog(makeLog()))).toEqual([
			{
				id: OTHER_ID,
				label: "",
				contentType: "image/avif",
				url: "/images/show/7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
				spectacleId: null,
			},
		]);
		expect(repo.findArtistMedia).toHaveBeenCalledWith(3);
	});
});

describe("UploadMediaUseCase", () => {
	it("stores a poster: row, link, upload, file", async () => {
		const repo = fakeRepo();
		const storage = fakeStorage();
		const data = { source: "data:image/png;base64,AA", label: "Saison 2", kind: "poster" as const };
		const result = await new UploadMediaUseCase(asRepo(repo), asStorage(storage)).execute(
			{ spectacleId: 7 },
			data,
			asLog(makeLog()),
		);

		expect(result).toEqual({
			id: MEDIA_ID,
			label: "Saison 2",
			contentType: "image/avif",
			url: "/images/show/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e",
		});
		// appended after the owner's last media
		expect(repo.nextOrder).toHaveBeenCalledWith(TX, { spectacleId: 7 });
		expect(repo.insertMedia).toHaveBeenCalledWith(TX, "Saison 2", 3);
		expect(repo.insertLink).toHaveBeenCalledWith(TX, { spectacleId: 7 }, MEDIA_ID, data);
		expect(storage.uploadFromSource).toHaveBeenCalledWith(
			"personal-tracker/show/media/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e",
			"data:image/png;base64,AA",
			"poster",
		);
		expect(repo.setFile).toHaveBeenCalledWith(TX, MEDIA_ID, {
			key: "personal-tracker/show/media/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e.avif",
			contentType: "image/avif",
		});
	});

	it("uses the large photo size for a spectacle programme", async () => {
		const repo = fakeRepo();
		const storage = fakeStorage();
		await new UploadMediaUseCase(asRepo(repo), asStorage(storage)).execute(
			{ spectacleId: 7 },
			{ source: "s", label: "", kind: "programme" },
			asLog(makeLog()),
		);
		expect(storage.uploadFromSource).toHaveBeenCalledWith(
			"personal-tracker/show/media/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e",
			"s",
			"photo",
		);
	});

	it("stores an artist portrait with its spectacle context", async () => {
		const repo = fakeRepo();
		const storage = fakeStorage();
		await new UploadMediaUseCase(asRepo(repo), asStorage(storage)).execute(
			{ artistId: 3 },
			{ source: "https://x/y.jpg", label: "", spectacleId: 7, kind: "poster" },
			asLog(makeLog()),
		);

		expect(repo.insertLink).toHaveBeenCalledWith(
			TX,
			{ artistId: 3 },
			MEDIA_ID,
			expect.objectContaining({ spectacleId: 7 }),
		);
		expect(storage.uploadFromSource).toHaveBeenCalledWith(
			"personal-tracker/show/media/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e",
			"https://x/y.jpg",
			"portrait",
		);
	});

	it("does not upload when the owner link fails", async () => {
		const repo = fakeRepo();
		const storage = fakeStorage();
		repo.insertLink.mockRejectedValue(new Error("fk"));

		await expect(
			new UploadMediaUseCase(asRepo(repo), asStorage(storage)).execute(
				{ spectacleId: 999 },
				{ source: "s", label: "", kind: "poster" },
				asLog(makeLog()),
			),
		).rejects.toThrow("fk");
		expect(storage.uploadFromSource).not.toHaveBeenCalled();
	});
});

describe("sortByMediaOrder", () => {
	it("sorts by position, then by upload time", () => {
		const link = (id: string, order: number, createdAt: string) => ({
			media: { id, label: "", contentType: "image/avif", order, createdAt },
		});
		const sorted = sortByMediaOrder([
			link("c", 1, "2026-01-01 10:00:00"),
			link("b", 0, "2026-01-02 10:00:00"),
			link("a", 0, "2026-01-01 10:00:00"),
		]);
		expect(sorted.map((l) => l.media.id)).toEqual(["a", "b", "c"]);
	});
});

describe("ReorderMediaUseCase", () => {
	it("stores each media position", async () => {
		const repo = fakeRepo();
		expect(
			await new ReorderMediaUseCase(asRepo(repo)).execute(
				{ spectacleId: 7 },
				{ mediaIds: [OTHER_ID, MEDIA_ID] },
				asLog(makeLog()),
			),
		).toBeUndefined();
		expect(repo.setOrder).toHaveBeenNthCalledWith(1, TX, OTHER_ID, 0);
		expect(repo.setOrder).toHaveBeenNthCalledWith(2, TX, MEDIA_ID, 1);
	});

	it.each([
		["a partial list", [MEDIA_ID]],
		["a duplicate", [MEDIA_ID, MEDIA_ID]],
		["a media of another owner", [MEDIA_ID, "99999999-9999-4999-8999-999999999999"]],
	])("rejects %s with a 400", async (_, mediaIds) => {
		const repo = fakeRepo();
		await expect(
			new ReorderMediaUseCase(asRepo(repo)).execute({ artistId: 3 }, { mediaIds }, asLog(makeLog())),
		).rejects.toMatchObject({ statusCode: 400 });
		expect(repo.setOrder).not.toHaveBeenCalled();
	});
});

describe("UpdateMediaUseCase", () => {
	it("returns null when the media does not belong to the owner", async () => {
		const repo = fakeRepo();
		repo.linkExists.mockResolvedValue(false);
		expect(
			await new UpdateMediaUseCase(asRepo(repo)).execute(
				{ spectacleId: 7 },
				MEDIA_ID,
				{ label: "x" },
				asLog(makeLog()),
			),
		).toBeNull();
		expect(repo.updateLabel).not.toHaveBeenCalled();
	});

	it("updates a poster label only", async () => {
		const repo = fakeRepo();
		await new UpdateMediaUseCase(asRepo(repo)).execute(
			{ spectacleId: 7 },
			MEDIA_ID,
			{ label: "x" },
			asLog(makeLog()),
		);
		expect(repo.updateLabel).toHaveBeenCalledWith(TX, MEDIA_ID, "x");
		expect(repo.updateArtistLink).not.toHaveBeenCalled();
	});

	it("updates a portrait label and spectacle context", async () => {
		const repo = fakeRepo();
		await new UpdateMediaUseCase(asRepo(repo)).execute({ artistId: 3 }, MEDIA_ID, { label: "x" }, asLog(makeLog()));
		expect(repo.updateArtistLink).toHaveBeenCalledWith(TX, 3, MEDIA_ID, null);
	});
});

describe("DeleteMediaUseCase", () => {
	it("returns null when the link does not exist", async () => {
		const repo = fakeRepo();
		const storage = fakeStorage();
		repo.deleteLink.mockResolvedValue([]);
		expect(
			await new DeleteMediaUseCase(asRepo(repo), asStorage(storage)).execute(
				{ spectacleId: 7 },
				MEDIA_ID,
				asLog(makeLog()),
			),
		).toBeNull();
		expect(storage.deleteObject).not.toHaveBeenCalled();
	});

	it("deletes the media and its file once the last link is gone", async () => {
		const repo = fakeRepo();
		const storage = fakeStorage();
		expect(
			await new DeleteMediaUseCase(asRepo(repo), asStorage(storage)).execute(
				{ spectacleId: 7 },
				MEDIA_ID,
				asLog(makeLog()),
			),
		).toBe(true);
		expect(repo.deleteMedia).toHaveBeenCalledWith(TX, MEDIA_ID);
		expect(storage.deleteObject).toHaveBeenCalledWith(
			"personal-tracker/show/media/0b9c1a2e-5d3f-4c8a-9e7b-1f2a3b4c5d6e.avif",
		);
	});

	it("keeps a media still linked to another owner", async () => {
		const repo = fakeRepo();
		const storage = fakeStorage();
		repo.countLinks.mockResolvedValue(1);
		await new DeleteMediaUseCase(asRepo(repo), asStorage(storage)).execute(
			{ artistId: 3 },
			MEDIA_ID,
			asLog(makeLog()),
		);
		expect(repo.deleteMedia).not.toHaveBeenCalled();
		expect(storage.deleteObject).not.toHaveBeenCalled();
	});

	it("turns a foreign key violation (media in use) into a 409", async () => {
		const repo = fakeRepo();
		const storage = fakeStorage();
		repo.deleteLink.mockRejectedValue(Object.assign(new Error("query failed"), { cause: { code: "23503" } }));
		await expect(
			new DeleteMediaUseCase(asRepo(repo), asStorage(storage)).execute(
				{ spectacleId: 7 },
				MEDIA_ID,
				asLog(makeLog()),
			),
		).rejects.toMatchObject({ statusCode: 409 });
	});

	it("only logs a failed S3 delete (the row is already gone)", async () => {
		const repo = fakeRepo();
		const storage = fakeStorage();
		storage.deleteObject.mockRejectedValue(new Error("s3 down"));
		const log = makeLog();
		expect(
			await new DeleteMediaUseCase(asRepo(repo), asStorage(storage)).execute(
				{ spectacleId: 7 },
				MEDIA_ID,
				asLog(log),
			),
		).toBe(true);
		expect(log.warn).toHaveBeenCalled();
	});
});
