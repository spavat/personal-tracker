import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { HeaderPortal } from "../../../components/HeaderPortal";
import PeriodSelector from "../../../components/PeriodSelector";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { useYearChanger } from "../../../hooks/use-year-changer";
import { bookHistory } from "../api";
import CardBook from "../components/CardBook";

export default function History({ year }: { year: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();

	const [period, listQuery, goPrevious, goNext, canGoPrevious, canGoNext] = useYearChanger({
		...bookHistory,
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

			<div className="grid">
				{listQuery.data.map((book) => (
					<CardBook key={`${book.book}`} book={book} />
				))}
			</div>

			{isOwner && (
				<div className="fab-container">
					<button
						type="button"
						className="fab-main"
						title="Ajouter un livre"
						onClick={() =>
							navigate({
								to: "/reading-book/history/$year/add",
								params: { year },
								search: { returnTo: location.pathname },
								replace: true,
								resetScroll: false,
								mask: { to: "/reading-book/history/$year", params: { year } },
							})
						}
					>
						<div className="pulse"></div>
						<div className="heart-line">
							<i className="fa-solid fa-plus"></i>
						</div>
					</button>
				</div>
			)}
			<Outlet />
		</>
	);
}
