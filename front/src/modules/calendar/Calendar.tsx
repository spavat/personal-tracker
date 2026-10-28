import { Outlet } from "@tanstack/react-router";
import { Fragment, ReactNode } from "react";

import { HeaderPortal } from "../../components/HeaderPortal";
import PeriodSelector from "../../components/period-selector";
import { useMonthChanger } from "../../hooks/use-month-changer";
import { formatMonth, getDurationString } from "../../utils";
import { monthCalendar } from "./api";
import Day from "./Day";
import HeaderCell from "./header-cell";

interface Day {
	id: string;
	title: string;
	disabled?: boolean;
	content?: string | any;
	date: string;
	details?: ReactNode;
}

interface Week {
	id: number;
	days: Array<Day>;
}

export default function Calendar({ period }: { period: string }) {

	const [{ data }, goPrevious, goNext, canGoPrevious, canGoNext] = useMonthChanger({
		...monthCalendar,
		navigationIsDisabled: () => {
			return false;
		},
		period,
	});

	const mapByDay =
		data?.reduce(
			(acc, item) => {
				acc[item.date] = item;
				return acc;
			},
			{} as Record<string, any>,
		) ?? {};

	const baseDay = Temporal.PlainDate.from(`${period}-01`);
	let currentDay = baseDay.subtract({ days: baseDay.dayOfWeek - 1 });
	const endOfMonth = baseDay.with({ day: baseDay.daysInMonth });
	const lastDay = endOfMonth.add({ days: 7 - endOfMonth.dayOfWeek });

	let endOfProcess = false;
	const weeks: Week[] = [];
	while (!endOfProcess) {
		for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
			const currentWeekNumber = currentDay.weekOfYear ?? 0;
			let currentWeek = weeks.find((week) => week.id === currentWeekNumber);
			if (!currentWeek) {
				currentWeek = {
					id: currentWeekNumber,
					days: [],
				};
				weeks.push(currentWeek);
			}
			let content = [];
			const dayData = mapByDay[currentDay.toString()];

			// musicals
			if (dayData?.show) {
				for (let show of dayData.show) {
					content.push(`🎭🎶 ${show.name}`);
				}
			}

			// music
			if (dayData?.music) {
				content.push(`🎶 ${getDurationString(dayData.music.duration)}`);
			}

			// internet
			if (dayData?.internet) {
				const internetTotal = dayData.internet.duration;
				const nbPrograms = dayData.internet.programs;
				const nbEpisodes = dayData.internet.episodes;
				content.push(`🎧 ${getDurationString(internetTotal)} (${nbEpisodes} ep. / ${nbPrograms} prog.)`);
			}

			// reading
			if (dayData?.["reading-book"]) {
				const nbBooks = dayData["reading-book"].books;
				const nbChapters = dayData["reading-book"].chapters;
				content.push(`📚 ${nbChapters} chap. (${nbBooks} livre${nbBooks > 1 ? "s" : ""} 🕮)`);
			}

			// manga reading
			if (dayData?.["reading-manga"]) {
				const nbMangas = dayData["reading-manga"].mangas;
				const nbChapters = dayData["reading-manga"].chapters;
				const nbVolumes = dayData["reading-manga"].volumes;
				let contentManga = "📚";
				if (nbVolumes) {
					contentManga += ` ${nbVolumes} vol.`;
				}
				if (nbChapters) {
					contentManga += ` ${nbChapters} chap.`;
				}
				contentManga += ` (${nbMangas} manga${nbMangas > 1 ? "s" : ""} 🕮)`;
				content.push(contentManga);
			}

			// game
			if (dayData?.game) {
				const nbGame = dayData.game.games;
				content.push(`🎮 ${getDurationString(dayData.game.duration)} (${nbGame} jeu${nbGame > 1 ? "x" : ""})`);
			}

			currentWeek.days.push({
				id: currentDay.toString(),
				date: currentDay.toString(),
				title: String(currentDay.day),
				disabled: !currentDay.toPlainYearMonth().equals(baseDay.toPlainYearMonth()),
				content: content.join("\n"),
			});
			currentDay = currentDay.add({ days: 1 });
			if (Temporal.PlainDate.compare(currentDay, lastDay) === 0) {
				endOfProcess = true;
			}
		}
	}

	return (
		<>
			<HeaderPortal>
				<PeriodSelector
					period={formatMonth(`${period}-01`)}
					goPrevious={goPrevious}
					goNext={goNext}
					canGoPrevious={canGoPrevious()}
					canGoNext={canGoNext()}
					type="month"
				/>
			</HeaderPortal>

			<div className="calendar">
				{["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map((label) => (
					<HeaderCell key={label} title={label} />
				))}
				{weeks.map((week) => (
					<Fragment key={week.id}>
						{week.days.map((day) => (
							<Day key={day.id} disabled={day.disabled} title={day.title} date={day.date} period={period}>
								{day.content}
							</Day>
						))}
					</Fragment>
				))}
			</div>
			<Outlet />
		</>
	);
}
