import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { PendingContent } from "../../../components/PendingContent";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { useSortTable } from "../../../hooks/use-sort-table";
import { gameListSort } from "../api";
import { formatPlayDuration } from "../duration";
import { formatLastPlayDate } from "../origins";
import { steamStoreUrl } from "../stores";

export default function GameList() {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();
	const { query, headers, isPending } = useSortTable({
		...gameListSort,
		columnsList: [
			null,
			{ name: "Statut", colName: "complete", isSortable: true },
			{ name: "Jeu", colName: "name", isSortable: true },
			{ name: "Developpeur", colName: "developper", isSortable: true },
			{ name: "Editeur", colName: "editor", isSortable: true },
			{ name: "Liens", colName: "", isSortable: false },
			{ name: "Dernière partie", colName: "latestPlayDate", isSortable: true },
			{ name: "Parties", colName: "playCount", isSortable: true },
			{ name: "Durée totale", colName: "totalDuration", isSortable: true },
			...(isOwner ? [{ name: "Actions", colName: "", isSortable: false }] : []),
		],
	});

	return (
		<>
			<PendingContent isPending={isPending}>
				<table className="list games alternate responsive">
					<thead>
						<tr>{headers.map((h) => h)}</tr>
					</thead>
					<tbody>
						{query.data.map((game, i) => (
							<tr key={game.id}>
								<td>{i + 1}</td>
								<td>{game.complete && <i className="complete-color fa-solid fa-circle-check"></i>}</td>
								<td>
									<Link to="/game/details/$gameId" params={{ gameId: game.id }}>
										{game.name}
									</Link>
								</td>
								<td data-label="Développeur">{game.developper}</td>
								<td data-label="Editeur">{game.editor}</td>
								<td data-label="Lien">
									{game.storeIds?.steam && <a href={steamStoreUrl(game.storeIds.steam)}>Steam</a>}
									{(game.links ?? []).map(({ name, link }) => (
										<Link key={name} to={link}>
											{name}
										</Link>
									))}
								</td>
								<td data-label="Dernière date">{formatLastPlayDate(game.latestPlayDate)}</td>
								<td data-label="Nombre">{game.playCount}</td>
								<td data-label="Durée totale">{formatPlayDuration(game.totalDuration) || "0min"}</td>
								{isOwner && (
									<td data-label="Actions">
										<button
											type="button"
											title="Modifier"
											onClick={() =>
												navigate({
													to: "/game/list/$gameId/edit",
													params: { gameId: game.id },
													replace: true,
													resetScroll: false,
													search: { returnTo: location.pathname },
													mask: {
														to: "/game/list",
													},
												})
											}
										>
											<i className="fa-regular fa-pen-to-square"></i>
										</button>
									</td>
								)}
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr>
							<td colSpan={isOwner ? 10 : 9}></td>
						</tr>
					</tfoot>
				</table>
			</PendingContent>

			{isOwner && (
				<div className="fab-container">
					<button
						type="button"
						className="fab-main"
						title="Ajouter un jeu"
						onClick={() =>
							navigate({
								to: "/game/list/add",
								search: { returnTo: location.pathname },
								replace: true,
								resetScroll: false,
								mask: { to: "/game/list" },
							})
						}
					>
						<div className="pulse"></div>
						<div className="heart-line" aria-hidden="true">
							<i className="fa-solid fa-plus"></i>
						</div>
					</button>
				</div>
			)}
			<Outlet />
		</>
	);
}
