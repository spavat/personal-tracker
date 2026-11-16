import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { S3_BUCKET, s3Client } from "../../config/s3";
import { fetchImageBuffer, type ImageSize, processImage } from "../images/image-processing";

const INTERNET_IMAGE_SIZE = {
	profile: { width: 200, height: 200 },
	banner: { width: 2500, height: 400 },
} satisfies Record<string, ImageSize>;

type InternetImageKind = keyof typeof INTERNET_IMAGE_SIZE;

// Anonymous/public reads aren't supported by the S3 provider (unsigned GET returns
// NoSuchBucket even with ACL public-read on the object), and generating a signed URL
// per image on every list/detail read is wasteful. Instead only the S3 key is kept in
// Mongo, and images are served through our own /images/internet/:id.field proxy route
// (see routes/images/images.routes.ts), which fetches the object from S3 on demand.
export class ImageStorageRepository {
	/** True if `value` is one of the proxy URLs we hand out for an already-uploaded image. */
	isOwnUrl(value: string): boolean {
		return value.startsWith("/images/internet/");
	}

	async uploadFromSource(keyWithoutExtension: string, source: string, kind: InternetImageKind): Promise<string> {
		const original = await fetchImageBuffer(source);
		const processed = await processImage(original, INTERNET_IMAGE_SIZE[kind]);
		const key = `${keyWithoutExtension}.avif`;

		await s3Client.send(
			new PutObjectCommand({
				Bucket: S3_BUCKET,
				Key: key,
				Body: processed,
				ContentType: "image/avif",
			}),
		);

		return key;
	}

	getObject(key: string) {
		return s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
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
