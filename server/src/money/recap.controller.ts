import { Controller, Get, Query } from "@nestjs/common";
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
	recap(@Query({ schema: RecapQuerySchema }) query: z.infer<typeof RecapQuerySchema>) {
		return this.service.recap(query);
	}
}
