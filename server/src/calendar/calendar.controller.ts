import type { z } from "zod";

import { Controller, Get, Query, SerializeOptions } from "@nestjs/common";
import {
	GetDailyCalendarRequestSchema,
	GetDailyCalendarResponseSchema,
	GetMonthlyCalendarRequestSchema,
	GetMonthlyCalendarResponseSchema,
	GetPeriodCalendarRequestSchema,
} from "@personal-tracker/shared/calendar";

import { CalendarService } from "./calendar.service.js";

// What happened each day across the domains (owner only)
@Controller("calendar")
export class CalendarController {
	constructor(private readonly service: CalendarService) {}

	@Get("monthly")
	@SerializeOptions({ schema: GetMonthlyCalendarResponseSchema.element })
	monthly(
		@Query({ schema: GetMonthlyCalendarRequestSchema }) { period }: z.infer<typeof GetMonthlyCalendarRequestSchema>,
	) {
		return this.service.monthly(period);
	}

	@Get("period")
	@SerializeOptions({ schema: GetMonthlyCalendarResponseSchema.element })
	period(@Query({ schema: GetPeriodCalendarRequestSchema }) query: z.infer<typeof GetPeriodCalendarRequestSchema>) {
		return this.service.period(query);
	}

	@Get("daily")
	@SerializeOptions({ schema: GetDailyCalendarResponseSchema })
	daily(@Query({ schema: GetDailyCalendarRequestSchema }) { date }: z.infer<typeof GetDailyCalendarRequestSchema>) {
		return this.service.daily(date);
	}
}
