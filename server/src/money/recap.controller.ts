import { Controller, Get, Query, SerializeOptions } from "@nestjs/common";
import { RecapResponseSchema } from "@personal-tracker/shared/money";
import * as z from "zod";

import { RecapService } from "./recap.service.js";

const RecapQuerySchema = z.object({
	from: z.string(),
	to: z.string(),
	regroupCategory: z.preprocess((val) => val === "true", z.boolean()),
});

// Mounted at /money by MoneyModule's RouterModule path
@Controller()
export class RecapController {
	constructor(private readonly service: RecapService) {}

	@Get("recap")
	@SerializeOptions({ schema: RecapResponseSchema })
	recap(@Query({ schema: RecapQuerySchema }) query: z.infer<typeof RecapQuerySchema>) {
		return this.service.recap(query);
	}
}
