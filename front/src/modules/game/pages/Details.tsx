import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { API_BASE_URL } from "../../../config";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { gameDetailsQuery } from "../api";
import GameOriginBadge from "../components/GameOriginBadge";
import PlayDate from "../components/PlayDate";
import { formatPlayDay } from "../origins";
import { steamStoreUrl } from "../stores";
import { formatPlayDuration } from "../time.utils";

export default function GameDetails({ gameId }: { gameId: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();

	const { data: gameData } = useSuspenseQuery(gameDetailsQuery(gameId));

	return (
		<>
			<div className="presentation">
				<div className="title">
					<h2>
						{gameData.name}
						{isOwner && (
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
						)}
					</h2>
				</div>
				<div className="general">
					{gameData.header && (
						<img src={`${API_BASE_URL}${gameData.header}`} alt="" className="game-header" />
					)}
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
						{((gameData.links ?? []).length > 0 || gameData.storeIds?.steam) && (
							<>
								<span>
									Liens:{" "}
									{gameData.storeIds?.steam && (
										<a href={steamStoreUrl(gameData.storeIds.steam)}>Steam</a>
									)}
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

			<table className="list plays alternate responsive">
				<thead>
					<tr data-title="Sessions de jeu">
						<th className="cell-index"></th>
						<th className="cell-date">Date</th>
						<th className="cell-duration">Durée</th>
						<th className="cell-text">Origine</th>
						<th className="cell-text">Commentaire</th>
						{isOwner && <th>Actions</th>}
					</tr>
				</thead>
				<tbody>
					{gameData.plays.map((play, i) => (
						<tr key={play.id}>
							<td className="cell-index">{i + 1}</td>
							<td className="cell-date" data-label="Date">
								<span className="weekday">{formatPlayDay(play)}</span> <PlayDate {...play} />
							</td>
							<td className="cell-duration" data-label="Durée">
								{formatPlayDuration(play.duration ?? 0)}
							</td>
							<td className="cell-text" data-label="Origine">
								{play.origin && <GameOriginBadge origin={play.origin} />}
							</td>
							<td className="cell-text" data-label="Commentaire" style={{ whiteSpace: "pre-line" }}>
								{play.comment}
							</td>
							{isOwner && (
								<td data-label="Actions">
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
							)}
						</tr>
					))}
				</tbody>
				<tfoot></tfoot>
			</table>

			{isOwner && (
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
			)}

			<Outlet />
		</>
	);
}
