import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";

import { fetchImageBuffer, type ImageSize, processImage } from "../storage/image.utils.js";
import { ObjectStorage } from "../storage/object-storage.js";
import { EPISODE_COVER_URL_PREFIX, episodeCoverKey } from "./broadcast.entity.js";

const BROADCAST_IMAGE_SIZE = {
	profile: { width: 200, height: 200 },
	banner: { width: 2500, height: 400 },
} satisfies Record<string, ImageSize>;

export type BroadcastImageKind = keyof typeof BROADCAST_IMAGE_SIZE;

// small: a line's thumbnail
const EPISODE_COVER_SIZE: ImageSize = { width: 300, height: 300 };

// Anonymous/public reads aren't supported by the S3 provider (unsigned GET returns
// NoSuchBucket even with ACL public-read on the object), and generating a signed URL
// per image on every list/detail read is wasteful. Instead only the S3 key is kept in
// Mongo, and images are served through our own /images/broadcast/:id.field proxy route,
// which fetches the object from S3 on demand.
@Injectable()
export class BroadcastImagesStorage {
	constructor(private readonly storage: ObjectStorage) {}

	/** True if `value` is one of the proxy URLs we hand out for an already-uploaded image. */
	isOwnUrl(value: string): boolean {
		return value.startsWith("/images/broadcast/");
	}

	// Downloads `source` (URL or data URI), resizes it to AVIF and stores it: returns the S3 key
	async uploadFromSource(programId: string, source: string, kind: BroadcastImageKind): Promise<string> {
		const processed = await processImage(await fetchImageBuffer(source), BROADCAST_IMAGE_SIZE[kind]);
		const key = `personal-tracker/broadcast/${programId}.${kind}.avif`;
		await this.storage.put(key, processed, "image/avif");
		return key;
	}

	/** True for the URL the server gave for an episode's stored cover (= unchanged) */
	isOwnEpisodeCoverUrl(value: string) {
		return value.startsWith(EPISODE_COVER_URL_PREFIX);
	}

	// Downloads `source` (URL or data URI) and resizes it to AVIF: read once, it can be stored for several episodes
	async readEpisodeCover(source: string) {
		return processImage(await fetchImageBuffer(source), EPISODE_COVER_SIZE);
	}

	// Returns the new S3 key
	async storeEpisodeCover(image: Buffer) {
		const key = episodeCoverKey(randomBytes(8).toString("hex"));
		await this.storage.put(key, image, "image/avif");
		return key;
	}

	deleteObject(key: string) {
		return this.storage.delete(key);
	}

	resolveImages<T extends { id?: string; profile?: string; banner?: string }>(item: T): T {
		if (!item.id) return item;
		return {
			...item,
			...(item.profile ? { profile: `/images/broadcast/${item.id}.profile` } : {}),
			...(item.banner ? { banner: `/images/broadcast/${item.id}.banner` } : {}),
		};
	}
}
