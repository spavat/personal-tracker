import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";

import { BadRequestError } from "../common/errors.js";
import { fetchImageBuffer, processImage } from "../storage/image.utils.js";
import { ObjectStorage } from "../storage/object-storage.js";
import { COVER_URL_PREFIX, coverKey } from "./book.entity.js";

const COVER_SIZE = { width: 600, height: 900 };

// Same proxy approach as the internet images: only the S3 key is kept in the DB,
// covers are served through /images/reading-book/edition/:id
@Injectable()
export class CoverStorage {
	constructor(private readonly storage: ObjectStorage) {}

	/** True for the URL the server gave for an existing cover (= unchanged) */
	isOwnUrl(value: string) {
		return value.startsWith(COVER_URL_PREFIX);
	}

	/** source: an image URL or a data URI. Returns the new S3 key. */
	async upload(editionId: string, source: string) {
		let body: Buffer;
		try {
			body = await processImage(await fetchImageBuffer(source), COVER_SIZE);
		} catch {
			throw new BadRequestError("invalid_image", "unreadable cover", { resource: "cover" });
		}
		const key = coverKey(editionId, randomBytes(4).toString("hex"));
		await this.storage.put(key, body, "image/avif");
		return key;
	}

	deleteObject(key: string) {
		return this.storage.delete(key);
	}
}
