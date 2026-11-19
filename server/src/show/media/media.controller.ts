import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
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
import { MediaService } from "./media.service.js";

type Upload = z.infer<typeof UploadMediaBodyRequestSchema>;
type Update = z.infer<typeof UpdateMediaBodyRequestSchema>;
type Reorder = z.infer<typeof ReorderMediaBodyRequestSchema>;

// Files can be sent as base64 data URIs: within the 15mb JSON limit (body-parsers.ts).
// The spectacle (poster, photo, programme) and artist (portraits) routes share the same service methods.
@Controller()
export class MediaController {
	constructor(private readonly service: MediaService) {}

	// --- spectacle ---

	@Get("spectacles/:spectacleId")
	@Public()
	listSpectacle(
		@Param({ schema: SpectacleMediaParamsRequestSchema }) { spectacleId }: { spectacleId: number },
		@Query({ schema: SpectacleMediaListQuerystringRequestSchema })
		{ kind }: z.infer<typeof SpectacleMediaListQuerystringRequestSchema>,
	) {
		return this.service.list({ spectacleId }, kind);
	}

	@Post("spectacles/:spectacleId")
	@HttpCode(201)
	uploadSpectacle(
		@Param({ schema: SpectacleMediaParamsRequestSchema }) { spectacleId }: { spectacleId: number },
		@Body({ schema: UploadMediaBodyRequestSchema }) body: Upload,
	) {
		return this.service.upload({ spectacleId }, body);
	}

	@Put("spectacles/:spectacleId/order")
	@HttpCode(204)
	async reorderSpectacle(
		@Param({ schema: SpectacleMediaParamsRequestSchema }) { spectacleId }: { spectacleId: number },
		@Body({ schema: ReorderMediaBodyRequestSchema }) body: Reorder,
	) {
		await this.service.reorder({ spectacleId }, body);
	}

	@Put("spectacles/:spectacleId/:mediaId")
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
		return this.service.list({ artistId }, undefined);
	}

	@Post("artists/:artistId")
	@HttpCode(201)
	uploadArtist(
		@Param({ schema: ArtistMediaParamsRequestSchema }) { artistId }: { artistId: number },
		@Body({ schema: UploadMediaBodyRequestSchema }) body: Upload,
	) {
		return this.service.upload({ artistId }, body);
	}

	@Put("artists/:artistId/order")
	@HttpCode(204)
	async reorderArtist(
		@Param({ schema: ArtistMediaParamsRequestSchema }) { artistId }: { artistId: number },
		@Body({ schema: ReorderMediaBodyRequestSchema }) body: Reorder,
	) {
		await this.service.reorder({ artistId }, body);
	}

	@Put("artists/:artistId/:mediaId")
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
		return (
			(await this.service.update(owner, mediaId, body)) ?? Promise.reject(new NotFoundError("Média introuvable"))
		);
	}

	private async delete(owner: MediaOwner, mediaId: string) {
		if (!(await this.service.delete(owner, mediaId))) {
			throw new NotFoundError("Média introuvable");
		}
	}
}
