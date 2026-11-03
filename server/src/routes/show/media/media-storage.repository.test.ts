import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("../../../config/s3", () => ({ S3_BUCKET: "bucket", s3Client: { send } }));

import sharp from "sharp";

import { MediaStorageRepository } from "./media-storage.repository";

const dataUri = (buffer: Buffer, type: string) => `data:${type};base64,${buffer.toString("base64")}`;

describe("MediaStorageRepository.uploadFromSource", () => {
	beforeEach(() => send.mockReset().mockResolvedValue({}));

	it("stores a PDF as-is", async () => {
		const pdf = Buffer.from("%PDF-1.7\n...");
		const file = await new MediaStorageRepository().uploadFromSource(
			"show/media/1",
			dataUri(pdf, "application/pdf"),
			"photo",
		);

		expect(file).toEqual({ key: "show/media/1.pdf", contentType: "application/pdf" });
		const put = send.mock.calls[0][0].input;
		expect(put).toMatchObject({ Bucket: "bucket", Key: "show/media/1.pdf", ContentType: "application/pdf" });
		expect(Buffer.compare(put.Body, pdf)).toBe(0);
	});

	it("converts an image to AVIF", async () => {
		const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } })
			.png()
			.toBuffer();
		const file = await new MediaStorageRepository().uploadFromSource(
			"show/media/2",
			dataUri(png, "image/png"),
			"poster",
		);

		expect(file).toEqual({ key: "show/media/2.avif", contentType: "image/avif" });
		expect((await sharp(send.mock.calls[0][0].input.Body).metadata()).format).toBe("heif");
	});

	it("rejects anything else with a 415, without writing to S3", async () => {
		await expect(
			new MediaStorageRepository().uploadFromSource(
				"show/media/3",
				dataUri(Buffer.from("hello"), "text/plain"),
				"photo",
			),
		).rejects.toMatchObject({ statusCode: 415 });
		expect(send).not.toHaveBeenCalled();
	});
});
