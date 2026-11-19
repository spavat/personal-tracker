import { S3Client } from "@aws-sdk/client-s3";
import { Inject, Module, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { Env } from "../config/env.schema.js";
import { ObjectStorage } from "./object-storage.js";
import { S3_BUCKET, S3_CLIENT } from "./storage.tokens.js";

@Module({
	providers: [
		{
			provide: S3_CLIENT,
			inject: [ConfigService],
			useFactory: (config: ConfigService<Env, true>) =>
				new S3Client({
					region: config.get("S3_REGION", { infer: true }),
					endpoint: config.get("S3_ENDPOINT", { infer: true }),
					forcePathStyle: true,
					credentials: {
						accessKeyId: config.get("S3_ACCESS_KEY_ID", { infer: true }),
						secretAccessKey: config.get("S3_SECRET_ACCESS_KEY", { infer: true }),
					},
				}),
		},
		{
			provide: S3_BUCKET,
			inject: [ConfigService],
			useFactory: (config: ConfigService<Env, true>) => config.get("S3_BUCKET", { infer: true }),
		},
		ObjectStorage,
	],
	exports: [ObjectStorage],
})
export class StorageModule implements OnApplicationShutdown {
	constructor(@Inject(S3_CLIENT) private readonly client: S3Client) {}

	onApplicationShutdown() {
		this.client.destroy();
	}
}
