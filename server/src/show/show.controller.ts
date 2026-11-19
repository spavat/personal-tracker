import type { z } from "zod";

import { Controller, Get, Logger, Query, SerializeOptions } from "@nestjs/common";
import { SearchQuerystringRequestSchema } from "@personal-tracker/shared/music";
import { GetReportQuerystringRequestSchema, GetReportResponseSchema } from "@personal-tracker/shared/show";

import { Public } from "../auth/public.decorator.js";
import { toUseCaseLog } from "../common/use-case-log.js";
import { GetReportUseCase, ShowUseCase } from "./show.useCases.js";

// Mounted at /show by ShowModule's RouterModule path
@Controller()
export class ShowController {
	private readonly log = toUseCaseLog(new Logger(ShowController.name));

	constructor(
		private readonly searchShow: ShowUseCase,
		private readonly getReport: GetReportUseCase,
	) {}

	@Get("search")
	@Public()
	search(
		@Query({ schema: SearchQuerystringRequestSchema }) { search }: z.infer<typeof SearchQuerystringRequestSchema>,
	) {
		return this.searchShow.execute(search ?? "", this.log);
	}

	@Get("reports")
	@SerializeOptions({ schema: GetReportResponseSchema })
	report(@Query({ schema: GetReportQuerystringRequestSchema }) period: { from: string; to: string }) {
		return this.getReport.execute(period, this.log);
	}
}
