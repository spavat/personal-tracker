import type {
	ReorderMediaBodyRequest,
	SpectacleMediaKind,
	UpdateMediaBodyRequest,
	UploadMediaBodyRequest,
} from "@personal-tracker/shared/show";

import { Injectable } from "@nestjs/common";

import type { UseCaseLog } from "../../common/use-case-log.js";

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
export class ListMediaUseCase {
	constructor(private repo: MediaRepository) {}

	async execute(owner: MediaOwner, kind: SpectacleMediaKind | undefined, log: UseCaseLog) {
		log.info("ListMediaUseCase.execute");
		return isArtistOwner(owner)
			? sortByMediaOrder(await this.repo.findArtistMedia(owner.artistId)).map(toArtistMedia)
			: sortByMediaOrder(await this.repo.findSpectacleMedia(owner.spectacleId, kind)).map(toSpectacleMedia);
	}
}

@Injectable()
export class UploadMediaUseCase {
	constructor(
		private repo: MediaRepository,
		private storage: MediaStorageRepository,
	) {}

	execute(owner: MediaOwner, data: UploadMediaBodyRequest, log: UseCaseLog) {
		log.info("UploadMediaUseCase.execute");
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
}

@Injectable()
export class UpdateMediaUseCase {
	constructor(private repo: MediaRepository) {}

	async execute(owner: MediaOwner, mediaId: string, data: UpdateMediaBodyRequest, log: UseCaseLog) {
		log.info("UpdateMediaUseCase.execute");
		if (!(await this.repo.linkExists(owner, mediaId))) {
			return null;
		}

		await this.repo.runInTransaction(async (tx) => {
			await this.repo.updateLabel(tx, mediaId, data.label);
			if (isArtistOwner(owner)) {
				await this.repo.updateArtistLink(tx, owner.artistId, mediaId, data.spectacleId ?? null);
			}
		});

		return true;
	}
}

@Injectable()
export class ReorderMediaUseCase {
	constructor(private repo: MediaRepository) {}

	async execute(owner: MediaOwner, { mediaIds }: ReorderMediaBodyRequest, log: UseCaseLog) {
		log.info("ReorderMediaUseCase.execute");
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
}

@Injectable()
export class DeleteMediaUseCase {
	constructor(
		private repo: MediaRepository,
		private storage: MediaStorageRepository,
	) {}

	async execute(owner: MediaOwner, mediaId: string, log: UseCaseLog) {
		log.info("DeleteMediaUseCase.execute");
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
			await this.storage.deleteObject(result.key).catch((error) => log.warn(error, "S3 media delete failed"));
		}
		return true;
	}
}
