import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Fragment } from "react";

import { formatDay, formatFullDate, getDurationString } from "../../utils";
import { gameDetailsQuery } from "./api";

export default function GameDetails({ gameId }: { gameId: string }) {
	const navigate = useNavigate();
	const location = useLocation();

	const { data: gameData } = useSuspenseQuery(gameDetailsQuery(gameId));

	return (
		<>
			<div className="presentation">
				<div className="title">
					<h2>
						{gameData.name}{" "}
						<button
							key="edit"
							type="button"
							title="Modifier"
							onClick={() =>
								navigate({
									to: "/game/details/$gameId/edit",
									replace: true,
									resetScroll: false,
									params: { gameId },
									search: { returnTo: location.pathname },
								})
							}
						>
							<i className="fa-regular fa-pen-to-square"></i>
						</button>
					</h2>
				</div>
				<div className="general">
					<div>
						{gameData.developper && (
							<>
								<span>
									Dev: <b>{gameData.developper}</b>
								</span>
								<br />
							</>
						)}
						{gameData.editor && (
							<>
								<span>
									Editeur : <b>{gameData.editor}</b>
								</span>
								<br />
							</>
						)}
						<span>Statut : {gameData.complete ? "Terminé" : "En cours"}</span>
						<br />
						{(gameData.links ?? []).length > 0 && (
							<>
								<span>
									Liens:{" "}
									{gameData.links?.map((l) => (
										<a key={l.name} href={l.link}>
											{l.name}
										</a>
									))}
								</span>
								<br />
							</>
						)}
					</div>
				</div>
				<div className="description">{gameData.comment && <>{gameData.comment}</>}</div>
				<div className="stats"></div>
			</div>

			<table className="list plays alternate">
				<thead>
					<tr>
						<th></th>
						<th></th>
						<th>Date</th>
						<th>Durée</th>
						<th>Commentaire</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{gameData.plays.map((play, i) => {
						return (
							<Fragment key={play.id}>
								<tr>
									<td className="smalltext">#{i + 1}</td>
									<td>{formatDay(play.date)}</td>
									<td>{formatFullDate(play.date)}</td>
									<td>{getDurationString(play.duration ?? 0)}</td>
									<td style={{ whiteSpace: "pre-line" }}>{play.comment}</td>
									<td>
										<button
											type="button"
											title="Modifier"
											onClick={() =>
												navigate({
													to: "/game/details/$gameId/play/$playId/edit",
													params: {
														gameId,
														playId: play.id,
													},
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
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
													to: "/game/details/$gameId/play/$playId/delete",
													params: {
														gameId,
														playId: play.id,
													},
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
												})
											}
										>
											<i className="fa-regular fa-trash-can"></i>
										</button>
										&nbsp;
									</td>
								</tr>
							</Fragment>
						);
					})}
				</tbody>
				<tfoot></tfoot>
			</table>

			<div className="fab-container">
				<button
					className="fab-main"
					type="button"
					title="Ajouter une partie"
					onClick={() =>
						navigate({
							to: "/game/details/$gameId/play/add",
							params: { gameId },
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
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
