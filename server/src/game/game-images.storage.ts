import { Injectable } from "@nestjs/common";

import { fetchImageBuffer, type ImageSize, processImage } from "../storage/image.utils.js";
import { ObjectStorage } from "../storage/object-storage.js";

export const GAME_IMAGE_FIELDS = ["capsule", "header"] as const;
export type GameImageField = (typeof GAME_IMAGE_FIELDS)[number];

// small banner and title image (Steam capsule / header sizes)
const GAME_IMAGE_SIZE: Record<GameImageField, ImageSize> = {
	capsule: { width: 184, height: 69 },
	header: { width: 460, height: 215 },
};

// Only the S3 key is kept on the game; images are served by the /images/game/:id/:field proxy route, like internet programs.
@Injectable()
export class GameImagesStorage {
	constructor(private readonly storage: ObjectStorage) {}

	/** True if `value` is one of the proxy URLs handed out for an already uploaded image. */
	isOwnUrl(value: string): boolean {
		return value.startsWith("/images/game/");
	}

	/** Downloads (or decodes a data URI), resizes to the field's size and stores the image; returns its S3 key. */
	async uploadFromSource(gameId: string, field: GameImageField, source: string): Promise<string> {
		const processed = await processImage(await fetchImageBuffer(source), GAME_IMAGE_SIZE[field]);
		const key = `personal-tracker/game/${gameId}.${field}.avif`;
		await this.storage.put(key, processed, "image/avif");
		return key;
	}

	/** S3 keys replaced by their proxy URLs. */
	resolveImages<T extends { id?: string; capsule?: string; header?: string }>(game: T): T {
		if (!game.id) return game;
		return {
			...game,
			...(game.capsule ? { capsule: `/images/game/${game.id}/capsule` } : {}),
			...(game.header ? { header: `/images/game/${game.id}/header` } : {}),
		};
	}
}
