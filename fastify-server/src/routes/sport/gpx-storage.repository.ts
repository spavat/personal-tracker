import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { S3_BUCKET, s3Client } from "../../config/s3";

export class GpxStorageRepository {
	upload(key: string, rawData: string) {
		return s3Client.send(
			new PutObjectCommand({
				Bucket: S3_BUCKET,
				Key: key,
				Body: rawData,
				ContentType: "application/gpx+xml",
			}),
		);
	}

	getDownloadUrl(key: string, filename: string) {
		return getSignedUrl(
			s3Client,
			new GetObjectCommand({
				Bucket: S3_BUCKET,
				Key: key,
				ResponseContentDisposition: `attachment; filename="${filename}.gpx"`,
			}),
			{ expiresIn: 60 },
		);
	}

	delete(key: string) {
		return s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
	}
}
