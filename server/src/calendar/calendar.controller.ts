import type { z } from "zod";

import { Controller, Get, Logger, Query, SerializeOptions } from "@nestjs/common";
import {
	GetDailyCalendarRequestSchema,
	GetDailyCalendarResponseSchema,
	GetMonthlyCalendarRequestSchema,
	GetMonthlyCalendarResponseSchema,
	GetPeriodCalendarRequestSchema,
} from "@personal-tracker/shared/calendar";

import { toUseCaseLog } from "../common/use-case-log.js";
import { GetDailyCalendarUseCase, GetMonthlyCalendarUseCase, GetPeriodCalendarUseCase } from "./calendar.useCases.js";

// What happened each day across the domains (owner only)
@Controller("calendar")
export class CalendarController {
	private readonly log = toUseCaseLog(new Logger(CalendarController.name));

	constructor(
		private readonly getMonthly: GetMonthlyCalendarUseCase,
		private readonly getPeriod: GetPeriodCalendarUseCase,
		private readonly getDaily: GetDailyCalendarUseCase,
	) {}

	@Get("monthly")
	@SerializeOptions({ schema: GetMonthlyCalendarResponseSchema.element })
	monthly(
		@Query({ schema: GetMonthlyCalendarRequestSchema }) { period }: z.infer<typeof GetMonthlyCalendarRequestSchema>,
	) {
		return this.getMonthly.execute(period, this.log);
	}

	@Get("period")
	@SerializeOptions({ schema: GetMonthlyCalendarResponseSchema.element })
	period(@Query({ schema: GetPeriodCalendarRequestSchema }) query: z.infer<typeof GetPeriodCalendarRequestSchema>) {
		return this.getPeriod.execute(query, this.log);
	}

	@Get("daily")
	@SerializeOptions({ schema: GetDailyCalendarResponseSchema })
	daily(@Query({ schema: GetDailyCalendarRequestSchema }) { date }: z.infer<typeof GetDailyCalendarRequestSchema>) {
		return this.getDaily.execute(date, this.log);
	}
}
