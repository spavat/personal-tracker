import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { S3_BUCKET, s3Client } from "../../config/s3";

export class ThumbnailStorageRepository {
	upload(key: string, buffer: Buffer) {
		return s3Client.send(
			new PutObjectCommand({
				Bucket: S3_BUCKET,
				Key: key,
				Body: buffer,
				ContentType: "image/avif",
			}),
		);
	}

	getObject(key: string) {
		return s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
	}

	delete(key: string) {
		return s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
	}
}
