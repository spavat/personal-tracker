import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { httpErrors } from "@fastify/sensible";
import { randomBytes } from "node:crypto";

import { S3_BUCKET, s3Client } from "../../config/s3";
import { fetchImageBuffer, processImage } from "../images/image-processing";
import { PORTRAIT_URL_PREFIX, portraitKey } from "./entity.entity";

// same size as the show portraits
const PORTRAIT_SIZE = { width: 400, height: 400 };

// Only the S3 key is kept in the DB, portraits are served through /images/entity/:id
export class PortraitStorageRepository {
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
			throw httpErrors.unsupportedMediaType("Portrait illisible");
		}
		const key = portraitKey(entityId, randomBytes(4).toString("hex"));
		await s3Client.send(
			new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: "image/avif" }),
		);
		return key;
	}

	getObject(key: string) {
		return s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
	}

	deleteObject(key: string) {
		return s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
	}
}
