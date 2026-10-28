import type { FastifyPluginAsync } from "fastify";

import { ZodTypeProvider } from "@marcalexiei/fastify-type-provider-zod";
import "@fastify/mongodb";
import {
	GetDailyCalendarRequestSchema,
	GetDailyCalendarResponseSchema,
	GetMonthlyCalendarRequestSchema,
	GetMonthlyCalendarResponseSchema,
	GetPeriodCalendarRequestSchema,
} from "@personal-tracker/shared/calendar";

import { GameRepository } from "../game/game.repository";
import { InternetRepository } from "../internet/internet.repository";
import { MusicRepository } from "../music/music.repository";
import { BookRepository } from "../reading-book/book.repository";
import { MangaRepository } from "../reading-manga/manga.repository";
import { PerformanceRepository } from "../show/performances/performance.repository";
import { GetDailyCalendarUseCase, GetMonthlyCalendarUseCase, GetPeriodCalendarUseCase } from "./calendar.useCases";

const calendarRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
	const musicRepository = new MusicRepository(fastify.mongo);
	const internetRepository = new InternetRepository(fastify.mongo);
	const bookRepository = new BookRepository(fastify.mongo);
	const mangaRepository = new MangaRepository(fastify.mongo);
	const performanceRepository = new PerformanceRepository(fastify.db);
	const gameRepository = new GameRepository(fastify.mongo);
	const getMonthlyCalendar = new GetMonthlyCalendarUseCase(
		musicRepository,
		internetRepository,
		bookRepository,
		mangaRepository,
		performanceRepository,
		gameRepository,
	);
	const getPeriodCalendar = new GetPeriodCalendarUseCase(
		musicRepository,
		internetRepository,
		bookRepository,
		mangaRepository,
		performanceRepository,
		gameRepository,
	);
	const getDailyCalendar = new GetDailyCalendarUseCase(
		musicRepository,
		internetRepository,
		bookRepository,
		mangaRepository,
		performanceRepository,
		gameRepository,
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/monthly",
		{
			schema: {
				querystring: GetMonthlyCalendarRequestSchema,
				response: {
					200: GetMonthlyCalendarResponseSchema,
				},
			},
		},
		async (request) => getMonthlyCalendar.execute(request.query.period, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/period",
		{
			schema: {
				querystring: GetPeriodCalendarRequestSchema,
				response: {
					200: GetMonthlyCalendarResponseSchema,
				},
			},
		},
		async (request) => getPeriodCalendar.execute(request.query, request.log),
	);

	fastify.withTypeProvider<ZodTypeProvider>().get(
		"/daily",
		{
			schema: {
				querystring: GetDailyCalendarRequestSchema,
				response: {
					200: GetDailyCalendarResponseSchema,
				},
			},
		},
		async (request) => getDailyCalendar.execute(request.query.date, request.log),
	);
};

export default calendarRoutes;
