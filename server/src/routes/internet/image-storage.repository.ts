import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { S3_BUCKET, s3Client } from "../../config/s3";

const IMAGE_TARGET_SIZE = {
	profile: { width: 200, height: 200 },
	banner: { width: 2500, height: 400 },
} as const;

export type ImageKind = keyof typeof IMAGE_TARGET_SIZE;

async function fetchImageBuffer(source: string): Promise<Buffer> {
	const dataUriMatch = source.match(/^data:([^;]+);base64,(.*)$/);
	if (dataUriMatch) {
		return Buffer.from(dataUriMatch[2], "base64");
	}

	const response = await fetch(source);
	if (!response.ok) {
		throw new Error(`Impossible de récupérer l'image depuis ${source}`);
	}
	return Buffer.from(await response.arrayBuffer());
}

function processImage(buffer: Buffer, kind: ImageKind): Promise<Buffer> {
	const { width, height } = IMAGE_TARGET_SIZE[kind];
	// fit "outside" + withoutEnlargement: resize down to cover the target box while
	// keeping the aspect ratio, but never upscale an image smaller than the target.
	return sharp(buffer)
		.resize(width, height, { fit: "outside", withoutEnlargement: true })
		.avif({ quality: 80 })
		.toBuffer();
}

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

	async uploadFromSource(keyWithoutExtension: string, source: string, kind: ImageKind): Promise<string> {
		const original = await fetchImageBuffer(source);
		const processed = await processImage(original, kind);
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
