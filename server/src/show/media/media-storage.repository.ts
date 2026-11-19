import { Injectable } from "@nestjs/common";

import { BadRequestError } from "../../common/errors.js";
import { fetchImageBuffer, processImage } from "../../storage/image.utils.js";
import { ObjectStorage } from "../../storage/object-storage.js";
import { SHOW_IMAGE_SIZE, type ShowImageKind } from "./media.entity.js";

const PDF_SIGNATURE = "%PDF-";

// Same proxy approach as the internet images: only the key is kept in the DB, files are served through /images/show/:id.
@Injectable()
export class MediaStorageRepository {
	constructor(private readonly storage: ObjectStorage) {}

	/** Images are resized and converted to AVIF, PDFs are stored as-is. */
	async uploadFromSource(
		keyWithoutExtension: string,
		source: string,
		imageKind: ShowImageKind,
	): Promise<{ key: string; contentType: string }> {
		const original = await fetchImageBuffer(source);

		let body: Buffer;
		let extension: string;
		let contentType: string;
		if (original.subarray(0, PDF_SIGNATURE.length).toString("latin1") === PDF_SIGNATURE) {
			body = original;
			extension = "pdf";
			contentType = "application/pdf";
		} else {
			try {
				body = await processImage(original, SHOW_IMAGE_SIZE[imageKind]);
			} catch {
				throw new BadRequestError("Format non supporté : image ou PDF uniquement");
			}
			extension = "avif";
			contentType = "image/avif";
		}

		const key = `${keyWithoutExtension}.${extension}`;
		await this.storage.put(key, body, contentType);
		return { key, contentType };
	}

	deleteObject(key: string) {
		return this.storage.delete(key);
	}
}
