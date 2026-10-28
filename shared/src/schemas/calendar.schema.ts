import * as z from "zod";

import { PeriodQSSchema } from "./common.schema";

//
// GET MONTHLY CALENDAR
//
// Object
export const MonthlyCalendarItemSchema = z.object({
	date: z.iso.date(),
	music: z
		.object({
			duration: z.number(),
		})
		.optional(),
	internet: z
		.object({
			duration: z.number(),
			episodes: z.number(),
			programs: z.number(),
		})
		.optional(),
	"reading-book": z
		.object({
			books: z.number(),
			chapters: z.number(),
		})
		.optional(),
	"reading-manga": z
		.object({
			mangas: z.number(),
			chapters: z.number(),
			volumes: z.number(),
		})
		.optional(),
	game: z
		.object({
			games: z.number(),
			duration: z.number(),
		})
		.optional(),
	show: z
		.array(
			z.object({
				name: z.string(),
			}),
		)
		.optional(),
});
// Request
export const GetMonthlyCalendarRequestSchema = z.object({
	period: z.string(),
});
export const GetPeriodCalendarRequestSchema = PeriodQSSchema;
// Response
export const GetMonthlyCalendarResponseSchema = z.array(MonthlyCalendarItemSchema);
export type GetMonthlyCalendarResponse = z.infer<typeof GetMonthlyCalendarResponseSchema>;

//
// GET DAILY CALENDAR
//
// Object
export const DailyMusicSchema = z.object({
	id: z.uuid(),
	artist: z.array(z.string()),
	album: z.string(),
	duration: z.number(),
	contextTags: z.array(z.string()).optional(),
	created: z.iso.datetime({ local: true }).optional(),
});
export const DailyInternetSchema = z.object({
	programId: z.uuid(),
	programName: z.string(),
	episodeId: z.uuid(),
	episodeName: z.string(),
	duration: z.number(),
	durationReal: z.number().optional(),
	contextTags: z.array(z.string()).optional(),
	created: z.iso.datetime({ local: true }).optional(),
	comment: z.string().optional(),
});
export const DialyBookReadingSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	contextTags: z.array(z.string()).optional(),
});
export const DailyBookSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	readings: z.array(DialyBookReadingSchema),
});
export const DailyMangaReadingSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	type: z.string(),
	contextTags: z.array(z.string()).optional(),
	created: z.iso.datetime({ local: true }).optional(),
});
export const DailyMangaSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	readings: z.array(DailyMangaReadingSchema),
});
export const DailyGameSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	developper: z.string(),
	plays: z.array(
		z.object({
			id: z.uuid(),
			duration: z.number(),
		}),
	),
});
export const DailyShowSchema = z.object({
	id: z.number(),
	name: z.string(),
	time: z.string(),
	place: z.string(),
});
export const DailyItemSchema = z.object({
	music: z.array(DailyMusicSchema).optional(),
	internet: z.array(DailyInternetSchema).optional(),
	"reading-book": z.array(DailyBookSchema).optional(),
	"reading-manga": z.array(DailyMangaSchema).optional(),
	game: z.array(DailyGameSchema).optional(),
	show: z.array(DailyShowSchema).optional(),
});
// Request
export const GetDailyCalendarRequestSchema = z.object({
	date: z.iso.date(),
});
// Response
export const GetDailyCalendarResponseSchema = DailyItemSchema;
export type GetDailyCalendarResponse = z.infer<typeof GetDailyCalendarResponseSchema>;
