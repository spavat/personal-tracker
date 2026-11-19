import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { httpErrors } from "@fastify/sensible";
import { randomBytes } from "node:crypto";

import { S3_BUCKET, s3Client } from "../../config/s3";
import { fetchImageBuffer, processImage } from "../images/image-processing";
import { COVER_URL_PREFIX, coverKey } from "./book.entity";

const COVER_SIZE = { width: 600, height: 900 };

// Same proxy approach as the internet images: only the S3 key is kept in the DB,
// covers are served through /images/reading-book/edition/:id
export class CoverStorageRepository {
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
			throw httpErrors.unsupportedMediaType("Image de couverture illisible");
		}
		const key = coverKey(editionId, randomBytes(4).toString("hex"));
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
