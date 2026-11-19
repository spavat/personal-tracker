import { Controller, Get, Query, SerializeOptions } from "@nestjs/common";
import {
	type RecapQuerystring,
	RecapQuerystringRequestSchema,
	RecapResponseSchema,
} from "@personal-tracker/shared/money";

import { RecapService } from "./recap.service.js";

// Mounted at /money by MoneyModule's RouterModule path
@Controller()
export class RecapController {
	constructor(private readonly service: RecapService) {}

	@Get("recap")
	@SerializeOptions({ schema: RecapResponseSchema })
	recap(@Query({ schema: RecapQuerystringRequestSchema }) query: RecapQuerystring) {
		return this.service.recap(query);
	}
}
