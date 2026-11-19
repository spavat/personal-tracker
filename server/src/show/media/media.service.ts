import type {
	ReorderMediaBodyRequest,
	SpectacleMediaKind,
	UpdateMediaBodyRequest,
	UploadMediaBodyRequest,
} from "@personal-tracker/shared/show";

import { Injectable, Logger } from "@nestjs/common";

import { BadRequestError, ConflictError } from "../../common/errors.js";
import { MediaStorageRepository } from "./media-storage.repository.js";
import {
	imageKindFor,
	isArtistOwner,
	mediaKey,
	mediaUrl,
	sortByMediaOrder,
	toArtistMedia,
	toSpectacleMedia,
	type MediaOwner,
} from "./media.entity.js";
import { MediaRepository } from "./media.repository.js";

const FOREIGN_KEY_VIOLATION = "23503";

function isForeignKeyViolation(error: unknown) {
	// drizzle wraps the pg error in `cause`
	const code =
		(error as { code?: string; cause?: { code?: string } })?.cause?.code ?? (error as { code?: string })?.code;
	return code === FOREIGN_KEY_VIOLATION;
}

@Injectable()
export class MediaService {
	private readonly logger = new Logger(MediaService.name);

	constructor(
		private readonly repo: MediaRepository,
		private readonly storage: MediaStorageRepository,
	) {}

	async list(owner: MediaOwner, kind: SpectacleMediaKind | undefined) {
		this.logger.log("list");
		return isArtistOwner(owner)
			? sortByMediaOrder(await this.repo.findArtistMedia(owner.artistId)).map(toArtistMedia)
			: sortByMediaOrder(await this.repo.findSpectacleMedia(owner.spectacleId, kind)).map(toSpectacleMedia);
	}

	upload(owner: MediaOwner, data: UploadMediaBodyRequest) {
		this.logger.log("upload");
		return this.repo.runInTransaction(async (tx) => {
			const order = await this.repo.nextOrder(tx, owner);
			const [{ id }] = await this.repo.insertMedia(tx, data.label, order);
			// link before the upload: an unknown owner fails here, without leaving an orphan file in S3
			await this.repo.insertLink(tx, owner, id, data);
			const file = await this.storage.uploadFromSource(mediaKey(id), data.source, imageKindFor(owner, data.kind));
			await this.repo.setFile(tx, id, file);
			return { id, label: data.label, contentType: file.contentType, url: mediaUrl(id) };
		});
	}

	async update(owner: MediaOwner, mediaId: string, data: UpdateMediaBodyRequest) {
		this.logger.log("update");
		if (!(await this.repo.linkExists(owner, mediaId))) {
			return null;
		}

		await this.repo.runInTransaction(async (tx) => {
			await this.repo.updateLabel(tx, mediaId, data.label);
			if (isArtistOwner(owner)) {
				await this.repo.updateArtistLink(tx, owner.artistId, mediaId, data.spectacleId ?? null);
			}
		});

		// the updated media, as the gallery lists it
		return (await this.list(owner, undefined)).find((media) => media.id === mediaId) ?? null;
	}

	async reorder(owner: MediaOwner, { mediaIds }: ReorderMediaBodyRequest) {
		this.logger.log("reorder");
		// the whole gallery, each media once: a partial list would leave ties
		const current = await this.repo.findMediaIds(owner);
		if (
			mediaIds.length !== current.length ||
			new Set(mediaIds).size !== mediaIds.length ||
			!mediaIds.every((id) => current.includes(id))
		) {
			throw new BadRequestError("La liste doit contenir chaque média une seule fois");
		}

		await this.repo.runInTransaction(async (tx) => {
			for (const [index, id] of mediaIds.entries()) {
				await this.repo.setOrder(tx, id, index);
			}
		});
	}

	async delete(owner: MediaOwner, mediaId: string) {
		this.logger.log("delete");
		let result: { found: boolean; key?: string };
		try {
			result = await this.repo.runInTransaction(async (tx) => {
				const deleted = await this.repo.deleteLink(tx, owner, mediaId);
				if (deleted.length === 0) {
					return { found: false };
				}
				// last owner gone: the media itself goes too
				if ((await this.repo.countLinks(tx, mediaId)) === 0) {
					const [media] = await this.repo.deleteMedia(tx, mediaId);
					return { found: true, key: media?.key };
				}
				return { found: true };
			});
		} catch (error) {
			if (isForeignKeyViolation(error)) {
				throw new ConflictError(
					"Média utilisé (représentation, rôle ou photo principale) : retirez-le d'abord",
				);
			}
			throw error;
		}

		if (!result.found) {
			return null;
		}
		// after the commit: a failed S3 delete only leaves an unreferenced file
		if (result.key) {
			await this.storage
				.deleteObject(result.key)
				.catch((error) => this.logger.warn(`S3 media delete failed (${result.key}): ${String(error)}`));
		}
		return true;
	}
}
