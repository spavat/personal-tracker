import { Controller, Get, Param, Query } from "@nestjs/common";
import {
	LatestGenericQuerystringRequestSchema,
	type LatestGenericQuerystringRequest,
	LatestParamsRequestSchema,
	LatestQuerystringRequestSchema,
	type RefIdsEnum,
} from "@personal-tracker/shared/internet";

import { LatestService } from "./latest.service.js";

@Controller()
export class LatestController {
	constructor(private readonly service: LatestService) {}

	@Get()
	latest(@Query({ schema: LatestGenericQuerystringRequestSchema }) query: LatestGenericQuerystringRequest) {
		return this.service.latest(query);
	}

	@Get(":programId")
	latestForProgram(
		@Param({ schema: LatestParamsRequestSchema }) { programId }: { programId: string },
		@Query({ schema: LatestQuerystringRequestSchema }) { force }: { force?: RefIdsEnum },
	) {
		return this.service.latestForProgram(programId, force);
	}
}
