import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import Badge from "../../components/badge";
import { HeaderPortal } from "../../components/HeaderPortal";
import PeriodSelector from "../../components/period-selector";
import { useMonthChanger } from "../../hooks/use-month-changer";
import { formatFullDate, formatMonth } from "../../utils";
import { listeningHistory } from "./api";

export default function List({ period }: { period: string }) {
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
	let index = 1;

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
						<th></th>
						<th>Date</th>
						<th>Artiste(s)</th>
						<th>Sortie</th>
						<th>Durée</th>
						<th>Genre</th>
						<th>Tags</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{listenings.length === 0 && (
						<tr>
							<td colSpan={8}>Aucune écoute trouvée.</td>
						</tr>
					)}
					{listenings.map((listening) => {
						let date = "????";
						if (listening.releaseDate) {
							date =
								listening.releaseDate.length === 4
									? listening.releaseDate
									: formatFullDate(listening.releaseDate);
						}
						return (
							<tr key={listening.id}>
								<td>#{index++}</td>
								<td data-label="Date d'écoute">{formatFullDate(listening.listeningDate)}</td>
								<td>
									{listening.artist.join(" • ")} - {listening.album}
								</td>
								<td data-label="Date de sortie">{date}</td>
								<td data-label="Durée">{listening.duration}</td>
								<td data-label="Genre">{listening.genre}</td>
								<td data-label="Contexte tag">
									{listening.contextTags?.map((contextTag) => (
										<Badge
											key={contextTag}
											icon="fa-solid fa-tag"
											name={contextTag}
											color="white"
											backgroundColor="darkgrey"
										></Badge>
									))}
								</td>
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
							</tr>
						);
					})}
				</tbody>
				<tfoot></tfoot>
			</table>
			<Outlet />

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
		</>
	);
}
