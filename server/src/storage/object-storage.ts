import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable } from "@nestjs/common";

import { S3_BUCKET, S3_CLIENT } from "./storage.tokens.js";

// Files (GPX, thumbnails, images) in the S3-compatible Garage bucket
@Injectable()
export class ObjectStorage {
	constructor(
		@Inject(S3_CLIENT) private readonly client: S3Client,
		@Inject(S3_BUCKET) private readonly bucket: string,
	) {}

	put(key: string, body: string | Buffer, contentType: string) {
		return this.client.send(
			new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
		);
	}

	get(key: string) {
		return this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
	}

	delete(key: string) {
		return this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
	}

	// A short-lived URL downloading the object as `filename`
	signedDownloadUrl(key: string, filename: string, expiresIn = 60) {
		return getSignedUrl(
			this.client,
			new GetObjectCommand({
				Bucket: this.bucket,
				Key: key,
				ResponseContentDisposition: `attachment; filename="${filename}"`,
			}),
			{ expiresIn },
		);
	}
}
