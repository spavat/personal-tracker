import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import ContextTagBadge from "../../../components/ContextTagBadge";
import DayDate from "../../../components/DayDate";
import { HeaderPortal } from "../../../components/HeaderPortal";
import PeriodSelector from "../../../components/PeriodSelector";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { useMonthChanger } from "../../../hooks/use-month-changer";
import { formatFullDate, formatMonth, getDurationString } from "../../../utils";
import { listeningHistory } from "../api";

export default function ListeningList({ period }: { period: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();
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

			<table className="list listenings alternate responsive">
				<thead>
					<tr>
						<th className="cell-index"></th>
						<th className="cell-date">Date</th>
						<th className="cell-text">Artiste(s)</th>
						<th className="cell-date col-release">Sortie</th>
						<th className="cell-duration col-duration">Durée</th>
						<th className="cell-text col-genre">Genre</th>
						<th className="cell-text col-tags">Tags</th>
						{isOwner && <th className="col-actions">Actions</th>}
					</tr>
				</thead>
				<tbody>
					{listenings.length === 0 && (
						<tr>
							<td colSpan={isOwner ? 8 : 7}>Aucune écoute trouvée.</td>
						</tr>
					)}
					{listenings.map((listening, i) => {
						let date = "????";
						if (listening.releaseDate) {
							date =
								listening.releaseDate.length === 4
									? listening.releaseDate
									: formatFullDate(listening.releaseDate);
						}
						return (
							<tr key={listening.id}>
								<td className="cell-index">{i + 1}</td>
								<td className="cell-date" data-label="Date d'écoute">
									<DayDate date={listening.listeningDate} />
								</td>
								<td className="cell-text">
									{listening.artist.join(" • ")} - {listening.album}
								</td>
								<td className="cell-date" data-label="Date de sortie">
									{date}
								</td>
								<td className="cell-duration" data-label="Durée">
									{getDurationString(listening.duration)}
								</td>
								<td className="cell-text" data-label="Genre">
									{listening.genre}
								</td>
								<td className="cell-text" data-label="Contexte tag">
									{listening.contextTags?.map((contextTag) => (
										<ContextTagBadge key={contextTag} name={contextTag} />
									))}
								</td>
								{isOwner && (
									<td data-label="Actions">
										<button
											type="button"
											title="Modifier"
											onClick={() =>
												navigate({
													to: "/music/list/$period/$listeningId/edit",
													params: { period, listeningId: listening.id },
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: {
														to: "/music/list/$period",
														params: { period },
													},
												})
											}
										>
											<i className="fa-regular fa-pen-to-square"></i>
										</button>
										&nbsp;
										<button
											type="button"
											title="Supprimer"
											onClick={() =>
												navigate({
													to: "/music/list/$period/$listeningId/delete",
													params: { period, listeningId: listening.id },
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: {
														to: "/music/list/$period",
														params: { period },
													},
												})
											}
										>
											<i className="fa-regular fa-trash-can"></i>
										</button>
									</td>
								)}
							</tr>
						);
					})}
				</tbody>
				<tfoot></tfoot>
			</table>
			<Outlet />

			{isOwner && (
				<div className="fab-container">
					<button
						type="button"
						className="fab-main"
						title="Ajouter une écoute"
						onClick={() =>
							navigate({
								to: "/music/list/$period/add",
								params: { period },
								search: { returnTo: location.pathname },
								replace: true,
								resetScroll: false,
								mask: {
									to: "/music/list/$period",
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
			)}
		</>
	);
}
