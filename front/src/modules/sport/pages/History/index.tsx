import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { HeaderPortal } from "../../../../components/HeaderPortal";
import PeriodSelector from "../../../../components/period-selector";
import { useMonthChanger } from "../../../../hooks/use-month-changer";
import { formatMonth } from "../../../../utils";
import { activityHistory } from "../../api";
import CardActivity from "./CardActivity";

export default function SportHistory({ period }: { period: string }) {
	const navigate = useNavigate();
	const location = useLocation();

	const [listQuery, goPrevious, goNext, canGoPrevious, canGoNext] = useMonthChanger({
		...activityHistory,
		navigationIsDisabled: (period: string, delta: "previous" | "next") => {
			if (delta === "next" && period >= Temporal.Now.plainDateISO().toPlainYearMonth().toString()) {
				return true;
			} else if (delta === "previous" && period <= "2018-01") {
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
					<p>Aucune activité ce mois-ci.</p>
				</div>
			)}

			<div className="grid">
				{listQuery.data.map((activity) => (
					<CardActivity key={activity.id} activity={activity} />
				))}
			</div>

			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					title="Ajouter une activité"
					onClick={() =>
						navigate({
							to: "/sport/history/$period/add",
							params: { period },
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/sport/history/$period", params: { period } },
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
