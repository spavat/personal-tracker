import { GameWithOverview } from "@personal-tracker/shared/game";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { HeaderPortal } from "../../components/HeaderPortal";
import PeriodSelector from "../../components/period-selector";
import { useYearChanger } from "../../hooks/use-year-changer";
import { formatMonth } from "../../utils";
import { playHistory } from "./api";
import GameCardGame from "./CardGame";

export default function History({ year }: { year: string }) {
	const navigate = useNavigate();
	const location = useLocation();

	const [period, listQuery, goPrevious, goNext, canGoPrevious, canGoNext] = useYearChanger({
		...playHistory,
		navigationIsDisabled: (period: string, delta: "previous" | "next") => {
			if (delta === "next" && period >= String(Temporal.Now.plainDateISO().year)) {
				return true;
			} else if (delta === "previous" && period <= "2024") {
				return true;
			}
			return false;
		},
		initialPeriod: year,
	});

	const sortedGames = listQuery.data.reduce(
		(agg: Record<string, Array<GameWithOverview>>, game: GameWithOverview) => {
			const lastDate = game.plays?.[game.plays?.length - 1]?.date ?? "";
			const month = lastDate.substring(5, 7);

			if (!agg[month]) {
				agg[month] = [];
			}
			agg[month].push(game);
			return agg;
		},
		{},
	);
	const sortedMonthKeys = Object.keys(sortedGames);
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

			<div>
				{sortedMonthKeys.map((month) => {
					const values = sortedGames[month];

					return (
						<div key={`${period}-${month}`}>
							<h2>
								{formatMonth(`${period}-${month}-01`)} ({values.length})
							</h2>
							<div className="grid">
								{values.map((game) => (
									<GameCardGame key={game.id} game={game} />
								))}
							</div>
						</div>
					);
				})}
			</div>

			<div className="fab-container">
				<button
					className="fab-main"
					type="button"
					aria-label="Ajouter une partie"
					onClick={() =>
						navigate({
							to: "/game/history/$year/add",
							params: { year: period },
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: {
								to: "/game/history/$year",
								params: { year: period },
							},
						})
					}
				>
					<div className="pulse"></div>
					<div className="heart-line" aria-hidden="true">
						<i className="fa-solid fa-plus"></i>
					</div>
				</button>
			</div>

			<Outlet />
		</>
	);
}
