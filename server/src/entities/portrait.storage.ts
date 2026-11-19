import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";

import { BadRequestError } from "../common/errors.js";
import { fetchImageBuffer, processImage } from "../storage/image-processing.js";
import { ObjectStorage } from "../storage/object-storage.js";
import { PORTRAIT_URL_PREFIX, portraitKey } from "./entity.entity.js";

// same size as the show portraits
const PORTRAIT_SIZE = { width: 400, height: 400 };

// Only the S3 key is kept in the DB, portraits are served through /images/entity/:id
@Injectable()
export class PortraitStorage {
	constructor(private readonly storage: ObjectStorage) {}

	/** True for the URL the server gave for an existing portrait (= unchanged) */
	isOwnUrl(value: string) {
		return value.startsWith(PORTRAIT_URL_PREFIX);
	}

	/** source: an image URL or a data URI. Returns the new S3 key. */
	async upload(entityId: string, source: string) {
		let body: Buffer;
		try {
			body = await processImage(await fetchImageBuffer(source), PORTRAIT_SIZE);
		} catch {
			throw new BadRequestError("Portrait illisible");
		}
		const key = portraitKey(entityId, randomBytes(4).toString("hex"));
		await this.storage.put(key, body, "image/avif");
		return key;
	}

	deleteObject(key: string) {
		return this.storage.delete(key);
	}
}
