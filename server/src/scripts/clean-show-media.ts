// One-off, after the migration of the show artists to entities (.scratch/show-core, ticket 02): deletes the S3 objects
// under the show media prefix that nothing references anymore (the artist pictures dropped with the gallery, and any
// older leftover). An object is kept while a show.media row or an entity portrait (core.entity.picture_key) names it.
// Usage, from server/ after a build: npm run clean-show-media (lists the keys), then npm run clean-show-media -- --delete
// Delete this script once it has run in production.
import { S3Client } from "@aws-sdk/client-s3";

import { envSchema } from "../config/env.schema.js";
import { createDrizzle } from "../database/drizzle.js";
import { coreEntity, showMedia } from "../database/schema.js";
import { ObjectStorage } from "../storage/object-storage.js";

const PREFIX = "personal-tracker/show/media/";

const env = envSchema
	.pick({
		DATABASE_URL: true,
		S3_ENDPOINT: true,
		S3_REGION: true,
		S3_BUCKET: true,
		S3_ACCESS_KEY_ID: true,
		S3_SECRET_ACCESS_KEY: true,
	})
	.parse(process.env);
const shouldDelete = process.argv.includes("--delete");

const client = new S3Client({
	region: env.S3_REGION,
	endpoint: env.S3_ENDPOINT,
	forcePathStyle: true,
	credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
});
const storage = new ObjectStorage(client, env.S3_BUCKET);
const db = createDrizzle(env.DATABASE_URL);

try {
	const referenced = new Set([
		...(await db.select({ key: showMedia.key }).from(showMedia)).map(({ key }) => key),
		...(await db.select({ key: coreEntity.pictureKey }).from(coreEntity)).flatMap(({ key }) => (key ? [key] : [])),
	]);
	const orphans = (await storage.list(PREFIX)).filter((key) => !referenced.has(key));

	for (const key of orphans) {
		if (shouldDelete) {
			await storage.delete(key);
		}
		console.log(`${shouldDelete ? "deleted" : "unreferenced"} ${key}`);
	}
	console.log(
		`${orphans.length} unreferenced object(s)${shouldDelete || !orphans.length ? "" : ", run with --delete to delete them"}`,
	);
} finally {
	await db.$client.end();
	client.destroy();
}
