import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ObjectStorage } from "../../storage/object-storage.js";

import { BadRequestError } from "../../common/errors.js";
import { MediaStorageRepository } from "./media-storage.repository.js";

const dataUri = (buffer: Buffer, type: string) => `data:${type};base64,${buffer.toString("base64")}`;

describe("MediaStorageRepository.uploadFromSource", () => {
	// injected: a fake instead of mocking the S3 module
	const storage = { put: vi.fn(), delete: vi.fn() };
	const repo = () => new MediaStorageRepository(storage as unknown as ObjectStorage);

	beforeEach(() => storage.put.mockReset().mockResolvedValue({}));

	it("stores a PDF as-is", async () => {
		const pdf = Buffer.from("%PDF-1.7\n...");

		const file = await repo().uploadFromSource("show/media/1", dataUri(pdf, "application/pdf"), "photo");

		expect(file).toEqual({ key: "show/media/1.pdf", contentType: "application/pdf" });
		const [key, body, contentType] = storage.put.mock.calls[0];
		expect([key, contentType]).toEqual(["show/media/1.pdf", "application/pdf"]);
		expect(Buffer.compare(body, pdf)).toBe(0);
	});

	it("converts an image to AVIF", async () => {
		const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } })
			.png()
			.toBuffer();

		const file = await repo().uploadFromSource("show/media/2", dataUri(png, "image/png"), "poster");

		expect(file).toEqual({ key: "show/media/2.avif", contentType: "image/avif" });
		expect((await sharp(storage.put.mock.calls[0][1]).metadata()).format).toBe("heif");
	});

	it("rejects anything else with BadRequestError, without writing to S3", async () => {
		await expect(
			repo().uploadFromSource("show/media/3", dataUri(Buffer.from("hello"), "text/plain"), "photo"),
		).rejects.toBeInstanceOf(BadRequestError);
		expect(storage.put).not.toHaveBeenCalled();
	});
});
