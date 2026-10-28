import { useNavigate, useLocation, Outlet } from "@tanstack/react-router";

import { HeaderPortal } from "../../components/HeaderPortal";
import PeriodSelector from "../../components/period-selector";
import { useMonthChanger } from "../../hooks/use-month-changer";
import { formatMonth } from "../../utils";
import { programHistory } from "./api";
import Card from "./Card";

export default function History({ period }: { period: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const [listQuery, goPrevious, goNext, canGoPrevious, canGoNext] = useMonthChanger({
		...programHistory,
		navigationIsDisabled: (period: string, delta: "previous" | "next") => {
			if (delta === "next" && period >= Temporal.Now.plainDateISO().toPlainYearMonth().toString()) {
				return true;
			} else if (delta === "previous" && period <= "2025-01") {
				return true;
			}
			return false;
		},
		period,
	});

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

			{listQuery.data.length === 0 && (
				<div className="empty-state">
					<p>
						<i className="fa-solid fa-circle-info fa-2xl"></i>
					</p>
					<p>Aucun programme écouté/vu ce mois-ci.</p>
				</div>
			)}

			<div className="grid">
				{listQuery.data.map((program) => {
					return <Card key={program.id} program={program} />;
				})}
			</div>

			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					title="Ajouter un programme"
					onClick={() =>
						navigate({
							to: "/internet/history/$period/add",
							params: { period },
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/internet/history/$period", params: { period } },
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
