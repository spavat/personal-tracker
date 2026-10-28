import { MusicListening } from "@personal-tracker/shared/music";
import { useNavigate, useLocation, Outlet } from "@tanstack/react-router";

import { HeaderPortal } from "../../components/HeaderPortal";
import PeriodSelector from "../../components/period-selector";
import { useMonthChanger } from "../../hooks/use-month-changer";
import { formatFullDay, formatMonth } from "../../utils";
import { listeningHistory } from "./api";

export default function History({ period }: { period: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const [listQuery, goPrevious, goNext, canGoPrevious, canGoNext] = useMonthChanger({
		...listeningHistory,
		navigationIsDisabled: (period: string, delta: "previous" | "next") => {
			if (delta === "next" && period >= Temporal.Now.plainDateISO().toPlainYearMonth().toString()) {
				return true;
			} else if (delta === "previous" && period <= "2024-01") {
				return true;
			}
			return false;
		},
		period,
	});

	const listenings = listQuery.data;
	const sortedListening = listenings.reduce(
		(agg: Record<string, Array<MusicListening>>, listening: MusicListening) => {
			const day = listening.listeningDate;

			if (!agg[day]) {
				agg[day] = [];
			}
			agg[day].push(listening);
			return agg;
		},
		{},
	);
	const hasListenings = listenings.length > 0;
	let index = 1;
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

			{!hasListenings && (
				<div className="empty-state">
					<p>
						<i className="fa-solid fa-circle-info fa-2xl"></i>
					</p>
					<p>Aucune écoute ce mois-ci.</p>
				</div>
			)}

			{hasListenings && (
				<div className="grid">
					{Object.entries(sortedListening).map(([day, values]) => (
						<div key={day} className="card_item">
							<h3>{formatFullDay(day)}</h3>
							{values.map((listening) => {
								let date = "????";
								if (listening.releaseDate) {
									date = listening.releaseDate.substring(0, 4);
								}
								return (
									<span key={listening.id}>
										<span>
											<span className="monospace">#{index++}</span>{" "}
											<b>{listening.artist.join(", ")}</b> - {listening.album} -<i> {date}</i>
										</span>{" "}
										<br />
									</span>
								);
							})}
						</div>
					))}
				</div>
			)}

			<Outlet />

			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					title="Ajouter une écoute"
					onClick={() =>
						navigate({
							to: "/music/history/$period/add",
							params: { period },
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: {
								to: "/music/history/$period",
								params: { period },
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
		</>
	);
}
