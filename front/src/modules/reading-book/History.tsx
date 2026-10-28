import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { HeaderPortal } from "../../components/HeaderPortal";
import PeriodSelector from "../../components/period-selector";
import { useYearChanger } from "../../hooks/use-year-changer";
import { formatDate } from "../../utils";
import { bookHistory } from "./api";
import { getStatusIcon } from "./utils";

export default function History({ year }: { year: string }) {
	const navigate = useNavigate();
	const location = useLocation();

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
					<div key={`${book.book}`} className="card_item">
						<span className="title">
							<Link to="/reading-book/book/$bookId" params={{ bookId: book.id }}>
								{book.book}
							</Link>
						</span>{" "}
						- <span className="subtitle">{book.author}</span>
						<br />
						{book.readings.length > 0 && (
							<details open>
								<summary>
									{book.readings.length} lecture{book.readings.length > 1 ? "s" : ""}
								</summary>
								{book.readings.map((reading, i) => (
									<p key={reading.id} className="monospace">
										<span className="smalltext">#{i + 1}</span> :{" "}
										{getStatusIcon(reading, { color: true })} {formatDate(reading.firstReadDate)} -{" "}
										{formatDate(reading.lastReadDate)} - {reading.readingDates.length} jour
										{reading.readingDates.length > 1 ? "s" : ""}
									</p>
								))}
							</details>
						)}
					</div>
				))}
			</div>

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
			<Outlet />
		</>
	);
}
