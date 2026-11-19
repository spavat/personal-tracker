import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Logger, Param, Post, Query } from "@nestjs/common";
import {
	ArtistMediaIdParamsRequestSchema,
	ArtistMediaParamsRequestSchema,
	ReorderMediaBodyRequestSchema,
	SpectacleMediaIdParamsRequestSchema,
	SpectacleMediaListQuerystringRequestSchema,
	SpectacleMediaParamsRequestSchema,
	UpdateMediaBodyRequestSchema,
	UploadMediaBodyRequestSchema,
} from "@personal-tracker/shared/show";

import type { MediaOwner } from "./media.entity.js";

import { Public } from "../../auth/public.decorator.js";
import { NotFoundError } from "../../common/errors.js";
import { toUseCaseLog } from "../../common/use-case-log.js";
import {
	DeleteMediaUseCase,
	ListMediaUseCase,
	ReorderMediaUseCase,
	UpdateMediaUseCase,
	UploadMediaUseCase,
} from "./media.useCases.js";

type Upload = z.infer<typeof UploadMediaBodyRequestSchema>;
type Update = z.infer<typeof UpdateMediaBodyRequestSchema>;
type Reorder = z.infer<typeof ReorderMediaBodyRequestSchema>;

// Files can be sent as base64 data URIs: within the 15mb JSON limit (body-parsers.ts).
// The spectacle (poster, photo, programme) and artist (portraits) routes share the same use cases.
@Controller()
export class MediaController {
	private readonly log = toUseCaseLog(new Logger(MediaController.name));

	constructor(
		private readonly listMedia: ListMediaUseCase,
		private readonly uploadMedia: UploadMediaUseCase,
		private readonly updateMedia: UpdateMediaUseCase,
		private readonly reorderMedia: ReorderMediaUseCase,
		private readonly deleteMedia: DeleteMediaUseCase,
	) {}

	// --- spectacle ---

	@Get("spectacles/:spectacleId")
	@Public()
	listSpectacle(
		@Param({ schema: SpectacleMediaParamsRequestSchema }) { spectacleId }: { spectacleId: number },
		@Query({ schema: SpectacleMediaListQuerystringRequestSchema })
		{ kind }: z.infer<typeof SpectacleMediaListQuerystringRequestSchema>,
	) {
		return this.listMedia.execute({ spectacleId }, kind, this.log);
	}

	@Post("spectacles/:spectacleId")
	@HttpCode(201)
	uploadSpectacle(
		@Param({ schema: SpectacleMediaParamsRequestSchema }) { spectacleId }: { spectacleId: number },
		@Body({ schema: UploadMediaBodyRequestSchema }) body: Upload,
	) {
		return this.uploadMedia.execute({ spectacleId }, body, this.log);
	}

	@Post("spectacles/:spectacleId/order")
	@HttpCode(204)
	async reorderSpectacle(
		@Param({ schema: SpectacleMediaParamsRequestSchema }) { spectacleId }: { spectacleId: number },
		@Body({ schema: ReorderMediaBodyRequestSchema }) body: Reorder,
	) {
		await this.reorderMedia.execute({ spectacleId }, body, this.log);
	}

	@Post("spectacles/:spectacleId/:mediaId")
	@HttpCode(204)
	updateSpectacle(
		@Param({ schema: SpectacleMediaIdParamsRequestSchema }) {
			spectacleId,
			mediaId,
		}: { spectacleId: number; mediaId: string },
		@Body({ schema: UpdateMediaBodyRequestSchema }) body: Update,
	) {
		return this.update({ spectacleId }, mediaId, body);
	}

	@Delete("spectacles/:spectacleId/:mediaId")
	@HttpCode(204)
	deleteSpectacle(
		@Param({ schema: SpectacleMediaIdParamsRequestSchema }) {
			spectacleId,
			mediaId,
		}: {
			spectacleId: number;
			mediaId: string;
		},
	) {
		return this.delete({ spectacleId }, mediaId);
	}

	// --- artist ---

	@Get("artists/:artistId")
	@Public()
	listArtist(@Param({ schema: ArtistMediaParamsRequestSchema }) { artistId }: { artistId: number }) {
		return this.listMedia.execute({ artistId }, undefined, this.log);
	}

	@Post("artists/:artistId")
	@HttpCode(201)
	uploadArtist(
		@Param({ schema: ArtistMediaParamsRequestSchema }) { artistId }: { artistId: number },
		@Body({ schema: UploadMediaBodyRequestSchema }) body: Upload,
	) {
		return this.uploadMedia.execute({ artistId }, body, this.log);
	}

	@Post("artists/:artistId/order")
	@HttpCode(204)
	async reorderArtist(
		@Param({ schema: ArtistMediaParamsRequestSchema }) { artistId }: { artistId: number },
		@Body({ schema: ReorderMediaBodyRequestSchema }) body: Reorder,
	) {
		await this.reorderMedia.execute({ artistId }, body, this.log);
	}

	@Post("artists/:artistId/:mediaId")
	@HttpCode(204)
	updateArtist(
		@Param({ schema: ArtistMediaIdParamsRequestSchema }) {
			artistId,
			mediaId,
		}: { artistId: number; mediaId: string },
		@Body({ schema: UpdateMediaBodyRequestSchema }) body: Update,
	) {
		return this.update({ artistId }, mediaId, body);
	}

	@Delete("artists/:artistId/:mediaId")
	@HttpCode(204)
	deleteArtist(
		@Param({ schema: ArtistMediaIdParamsRequestSchema }) {
			artistId,
			mediaId,
		}: {
			artistId: number;
			mediaId: string;
		},
	) {
		return this.delete({ artistId }, mediaId);
	}

	private async update(owner: MediaOwner, mediaId: string, body: Update) {
		if (!(await this.updateMedia.execute(owner, mediaId, body, this.log))) {
			throw new NotFoundError("Média introuvable");
		}
	}

	private async delete(owner: MediaOwner, mediaId: string) {
		if (!(await this.deleteMedia.execute(owner, mediaId, this.log))) {
			throw new NotFoundError("Média introuvable");
		}
	}
}
