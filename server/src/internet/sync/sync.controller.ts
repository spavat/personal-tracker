import type { z } from "zod";

import { Body, Controller, Delete, Get, HttpCode, Param, Post, SerializeOptions } from "@nestjs/common";
import {
	SyncCreateResponseSchema,
	SyncDeleteParamsRequestSchema,
	SyncFeedBodyRequestSchema,
	type SyncFeedBodyRequest,
	SyncGopodderStatusResponseSchema,
	SyncLinkFeedBodyRequestSchema,
	type SyncLinkFeedBodyRequest,
	SyncProposalParamsRequestSchema,
	SyncReprocessBodyRequestSchema,
	SyncResponseSchema,
	SyncUnknownFeedsResponseSchema,
	SyncUploadBodyRequestSchema,
	SyncValidateBodyRequestSchema,
	type SyncValidateBodyRequestType,
} from "@personal-tracker/shared/internet";

import { SyncService } from "./sync.service.js";

@Controller()
export class SyncController {
	constructor(private readonly service: SyncService) {}

	@Get()
	@SerializeOptions({ schema: SyncResponseSchema.element })
	list() {
		return this.service.list();
	}

	// An AntennaPod backup: a raw SQLite file sent as application/octet-stream (see body-parsers.ts)
	@Post("upload")
	@HttpCode(200)
	upload(@Body({ schema: SyncUploadBodyRequestSchema }) backup: Uint8Array) {
		return this.service.uploadAntennaPod(backup);
	}

	@Get("gopodder")
	@SerializeOptions({ schema: SyncGopodderStatusResponseSchema })
	gopodderStatus() {
		return this.service.gopodderStatus();
	}

	@Post("gopodder")
	@HttpCode(200)
	@SerializeOptions({ schema: SyncCreateResponseSchema })
	syncGopodder() {
		return this.service.syncGopodder();
	}

	@Get("feeds")
	@SerializeOptions({ schema: SyncUnknownFeedsResponseSchema.element })
	unknownFeeds() {
		return this.service.unknownFeeds();
	}

	@Post("feeds/link")
	@HttpCode(200)
	linkFeed(@Body({ schema: SyncLinkFeedBodyRequestSchema }) { rssUrl, programId }: SyncLinkFeedBodyRequest) {
		return this.service.linkFeed(rssUrl, programId);
	}

	// POST with a body (not DELETE /:id): the key is a feed URL
	@Post("feeds/ignore")
	@HttpCode(200)
	ignoreFeed(@Body({ schema: SyncFeedBodyRequestSchema }) { rssUrl }: SyncFeedBodyRequest) {
		return this.service.ignoreFeed(rssUrl);
	}

	@Post("reprocess")
	@HttpCode(200)
	reprocess(@Body({ schema: SyncReprocessBodyRequestSchema }) body: z.infer<typeof SyncReprocessBodyRequestSchema>) {
		return this.service.reprocess(body?.rssUrl);
	}

	// an action on the proposal: 200 with the program (a new one) or the episode created from it
	@Post(":id/validate")
	@HttpCode(200)
	validate(
		@Param({ schema: SyncProposalParamsRequestSchema }) { id }: { id: string },
		@Body({ schema: SyncValidateBodyRequestSchema }) body: SyncValidateBodyRequestType,
	) {
		return this.service.validate(id, body);
	}

	@Delete(":id")
	@HttpCode(204)
	async delete(@Param({ schema: SyncDeleteParamsRequestSchema }) { id }: { id: string }) {
		await this.service.delete(id);
	}
}
