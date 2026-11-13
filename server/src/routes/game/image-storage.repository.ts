import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { S3_BUCKET, s3Client } from "../../config/s3";
import { fetchImageBuffer, processImage } from "../internet/image-storage.repository";

export const GAME_IMAGE_FIELDS = ["capsule", "header"] as const;
export type GameImageField = (typeof GAME_IMAGE_FIELDS)[number];

// Only the S3 key is kept on the game; images are served by the /images/game/:id.field proxy route
// (routes/images/images.routes.ts), like internet programs.
export class GameImageStorageRepository {
	/** True if `value` is one of the proxy URLs handed out for an already uploaded image. */
	isOwnUrl(value: string): boolean {
		return value.startsWith("/images/game/");
	}

	/** Downloads (or decodes a data URI), resizes to the field's size and stores the image; returns its S3 key. */
	async uploadFromSource(gameId: string, field: GameImageField, source: string): Promise<string> {
		const processed = await processImage(await fetchImageBuffer(source), field);
		const key = `personal-tracker/game/${gameId}.${field}.avif`;
		await s3Client.send(
			new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: processed, ContentType: "image/avif" }),
		);
		return key;
	}

	getObject(key: string) {
		return s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
	}

	/** S3 keys replaced by their proxy URLs. */
	resolveImages<T extends { id?: string; capsule?: string; header?: string }>(game: T): T {
		if (!game.id) return game;
		return {
			...game,
			...(game.capsule ? { capsule: `/images/game/${game.id}.capsule` } : {}),
			...(game.header ? { header: `/images/game/${game.id}.header` } : {}),
		};
	}
}
