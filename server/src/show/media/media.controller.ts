import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, SerializeOptions } from "@nestjs/common";
import {
	MediaSchema,
	ReorderMediaBodyRequestSchema,
	SpectacleMediaIdParamsRequestSchema,
	SpectacleMediaListQuerystringRequestSchema,
	SpectacleMediaParamsRequestSchema,
	SpectacleMediaSchema,
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
// The spectacle media: posters, photos, programmes.
@Controller()
export class MediaController {
	constructor(private readonly service: MediaService) {}

	// --- spectacle ---

	@Get("spectacles/:spectacleId")
	@Public()
	@SerializeOptions({ schema: SpectacleMediaSchema })
	listSpectacle(
		@Param({ schema: SpectacleMediaParamsRequestSchema }) { spectacleId }: { spectacleId: string },
		@Query({ schema: SpectacleMediaListQuerystringRequestSchema })
		{ kind }: z.infer<typeof SpectacleMediaListQuerystringRequestSchema>,
	) {
		return this.service.list({ spectacleId }, kind);
	}

	@Post("spectacles/:spectacleId")
	@HttpCode(201)
	@SerializeOptions({ schema: MediaSchema })
	uploadSpectacle(
		@Param({ schema: SpectacleMediaParamsRequestSchema }) { spectacleId }: { spectacleId: string },
		@Body({ schema: UploadMediaBodyRequestSchema }) body: Upload,
	) {
		return this.service.upload({ spectacleId }, body);
	}

	@Put("spectacles/:spectacleId/order")
	@HttpCode(204)
	async reorderSpectacle(
		@Param({ schema: SpectacleMediaParamsRequestSchema }) { spectacleId }: { spectacleId: string },
		@Body({ schema: ReorderMediaBodyRequestSchema }) body: Reorder,
	) {
		await this.service.reorder({ spectacleId }, body);
	}

	@Put("spectacles/:spectacleId/:mediaId")
	@SerializeOptions({ schema: SpectacleMediaSchema })
	updateSpectacle(
		@Param({ schema: SpectacleMediaIdParamsRequestSchema }) {
			spectacleId,
			mediaId,
		}: { spectacleId: string; mediaId: string },
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
			spectacleId: string;
			mediaId: string;
		},
	) {
		return this.delete({ spectacleId }, mediaId);
	}

	private async update(owner: MediaOwner, mediaId: string, body: Update) {
		return (await this.service.update(owner, mediaId, body)) ?? Promise.reject(new NotFoundError("media"));
	}

	private async delete(owner: MediaOwner, mediaId: string) {
		if (!(await this.service.delete(owner, mediaId))) {
			throw new NotFoundError("media");
		}
	}
}
