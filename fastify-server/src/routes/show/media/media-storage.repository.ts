import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { httpErrors } from "@fastify/sensible";

import { S3_BUCKET, s3Client } from "../../../config/s3";
import { fetchImageBuffer, processImage } from "../../images/image-processing";
import { SHOW_IMAGE_SIZE, type ShowImageKind } from "./media.entity";

const PDF_SIGNATURE = "%PDF-";

// Same proxy approach as ImageStorageRepository: only the key is kept in the DB,
// files are served through /images/show/:id.
export class MediaStorageRepository {
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
				throw httpErrors.unsupportedMediaType("Format non supporté : image ou PDF uniquement");
			}
			extension = "avif";
			contentType = "image/avif";
		}

		const key = `${keyWithoutExtension}.${extension}`;
		await s3Client.send(
			new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: body, ContentType: contentType }),
		);

		return { key, contentType };
	}

	getObject(key: string) {
		return s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
	}

	deleteObject(key: string) {
		return s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
	}
}
