import { Injectable } from "@nestjs/common";

import { fetchImageBuffer, type ImageSize, processImage } from "../storage/image-processing.js";
import { ObjectStorage } from "../storage/object-storage.js";

const INTERNET_IMAGE_SIZE = {
	profile: { width: 200, height: 200 },
	banner: { width: 2500, height: 400 },
} satisfies Record<string, ImageSize>;

export type InternetImageKind = keyof typeof INTERNET_IMAGE_SIZE;

// Anonymous/public reads aren't supported by the S3 provider (unsigned GET returns
// NoSuchBucket even with ACL public-read on the object), and generating a signed URL
// per image on every list/detail read is wasteful. Instead only the S3 key is kept in
// Mongo, and images are served through our own /images/internet/:id.field proxy route,
// which fetches the object from S3 on demand.
@Injectable()
export class InternetImagesStorage {
	constructor(private readonly storage: ObjectStorage) {}

	/** True if `value` is one of the proxy URLs we hand out for an already-uploaded image. */
	isOwnUrl(value: string): boolean {
		return value.startsWith("/images/internet/");
	}

	// Downloads `source` (URL or data URI), resizes it to AVIF and stores it: returns the S3 key
	async uploadFromSource(programId: string, source: string, kind: InternetImageKind): Promise<string> {
		const processed = await processImage(await fetchImageBuffer(source), INTERNET_IMAGE_SIZE[kind]);
		const key = `personal-tracker/internet/${programId}.${kind}.avif`;
		await this.storage.put(key, processed, "image/avif");
		return key;
	}

	resolveImages<T extends { id?: string; profile?: string; banner?: string }>(item: T): T {
		if (!item.id) return item;
		return {
			...item,
			...(item.profile ? { profile: `/images/internet/${item.id}.profile` } : {}),
			...(item.banner ? { banner: `/images/internet/${item.id}.banner` } : {}),
		};
	}
}
