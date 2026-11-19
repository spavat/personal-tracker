import type { z } from "zod";

import { Controller, Get, Query, SerializeOptions } from "@nestjs/common";
import { SearchQuerystringRequestSchema } from "@personal-tracker/shared/music";
import { GetReportQuerystringRequestSchema, GetReportResponseSchema } from "@personal-tracker/shared/show";

import { Public } from "../auth/public.decorator.js";
import { ShowService } from "./show.service.js";

// Mounted at /show by ShowModule's RouterModule path
@Controller()
export class ShowController {
	constructor(private readonly service: ShowService) {}

	@Get("search")
	@Public()
	search(
		@Query({ schema: SearchQuerystringRequestSchema }) { search }: z.infer<typeof SearchQuerystringRequestSchema>,
	) {
		return this.service.search(search ?? "");
	}

	@Get("reports")
	@SerializeOptions({ schema: GetReportResponseSchema })
	report(@Query({ schema: GetReportQuerystringRequestSchema }) period: { from: string; to: string }) {
		return this.service.report(period);
	}
}
