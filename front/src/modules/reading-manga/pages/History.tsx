import { MangaOverview, Reading } from "@personal-tracker/shared/reading-manga";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { HeaderPortal } from "../../../components/HeaderPortal";
import PeriodSelector from "../../../components/period-selector";
import { useYearChanger } from "../../../hooks/use-year-changer";
import { formatMonth } from "../../../utils";
import { mangaHistory } from "../api";
import ReadingCardManga from "../CardManga";
import { FrontManga } from "../types";
import { mergeReadings } from "../utils";

export default function History({ year }: { year: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const [period, listQuery, goPrevious, goNext, canGoPrevious, canGoNext] = useYearChanger({
		...mangaHistory,
		navigationIsDisabled: (period: string, delta: "previous" | "next") => {
			if (delta === "next" && period >= String(Temporal.Now.plainDateISO().year)) {
				return true;
			} else if (delta === "previous" && period <= "2022") {
				return true;
			}
			return false;
		},
		initialPeriod: year,
	});

	const sortedReadings: Record<string, Array<FrontManga.ExtendedManga>> = listQuery.data.reduce(
		(agg: Record<string, Array<FrontManga.ExtendedManga>>, manga: MangaOverview) => {
			const lastDate = manga.readings?.[manga.readings?.length - 1]?.date ?? "";
			const month = lastDate.substring(5, 7);

			if (!agg[month]) {
				agg[month] = [];
			}
			agg[month].push({
				...manga,
				mergedReadings: mergeReadings<Reading>(manga.readings ?? [], { sort: "asc" }),
			});
			return agg;
		},
		{},
	);
	const sortedMonthKeys = Object.keys(sortedReadings);
	sortedMonthKeys.sort((k1, k2) => k2.localeCompare(k1));

	return (
		<>
			<HeaderPortal>
				<PeriodSelector
					period={`Année ${period}`}
					goPrevious={goPrevious}
					goNext={goNext}
					canGoPrevious={canGoPrevious()}
					canGoNext={canGoNext()}
					type="year"
				/>
			</HeaderPortal>

			{sortedMonthKeys.map((month) => {
				const mangaValues = sortedReadings[month];
				return (
					<div key={`${month}`}>
						<h2>
							{formatMonth(`${period}-${month}-01`)} ({mangaValues.length})
						</h2>
						<div className="grid">
							{mangaValues.map((manga) => (
								<ReadingCardManga key={manga.title} manga={manga} />
							))}
						</div>
					</div>
				);
			})}
			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					title="Ajouter un manga"
					onClick={() =>
						navigate({
							to: "/reading-manga/history/$year/add",
							params: { year: period },
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: {
								to: "/reading-manga/history/$year",
								params: { year: period },
							},
						})
					}
				>
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-plus"></i>
					</div>
				</button>
			</div>
			<Outlet />
		</>
	);
}
