import { Controller, Get, Param, Query, SerializeOptions } from "@nestjs/common";
import {
	LatestEpisodesResponseSchema,
	type LatestGenericQuerystringRequest,
	LatestGenericQuerystringRequestSchema,
	LatestParamsRequestSchema,
	LatestQuerystringRequestSchema,
	type RefIdsEnum,
} from "@personal-tracker/shared/broadcast";

import { LatestService } from "./latest.service.js";

@Controller()
export class LatestController {
	constructor(private readonly service: LatestService) {}

	@Get()
	@SerializeOptions({ schema: LatestEpisodesResponseSchema })
	latest(@Query({ schema: LatestGenericQuerystringRequestSchema }) query: LatestGenericQuerystringRequest) {
		return this.service.latest(query);
	}

	@Get(":programId")
	@SerializeOptions({ schema: LatestEpisodesResponseSchema })
	latestForProgram(
		@Param({ schema: LatestParamsRequestSchema }) { programId }: { programId: string },
		@Query({ schema: LatestQuerystringRequestSchema }) { force }: { force?: RefIdsEnum },
	) {
		return this.service.latestForProgram(programId, force);
	}
}
