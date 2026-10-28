import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { PendingContent } from "../../components/pending-content";
import { useSortTable } from "../../hooks/use-sort-table";
import { formatFullDate } from "../../utils";
import { gameListSort } from "./api";

export default function GameList() {
	const navigate = useNavigate();
	const location = useLocation();
	const { query, headers, isPending } = useSortTable({
		...gameListSort,
		columnsList: [
			null,
			{ name: "Statut", colName: "complete", isSortable: true },
			{ name: "Jeu", colName: "name", isSortable: true },
			{ name: "Editeur", colName: "editor", isSortable: true },
			{ name: "Developpeur", colName: "developper", isSortable: true },
			{ name: "Liens", colName: "", isSortable: false },
			{ name: "Dernière partie", colName: "latestPlayDate", isSortable: true },
			{ name: "Parties", colName: "playCount", isSortable: true },
			{ name: "Actions", colName: "", isSortable: false },
		],
	});

	return (
		<>
			<PendingContent isPending={isPending}>
				<table className="list games alternate">
					<thead>
						<tr>{headers.map((h) => h)}</tr>
					</thead>
					<tbody>
						{query.data.map((game, i) => {
							return (
								<tr key={game.id}>
									<td>{i + 1}</td>
									<td>
										{game.complete && <i className="complete-color fa-solid fa-circle-check"></i>}
									</td>
									<td>
										<Link to="/game/details/$gameId" params={{ gameId: game.id }}>
											{game.name}
										</Link>
									</td>
									<td>{game.editor}</td>
									<td>{game.developper}</td>
									<td>
										{(game.links ?? []).map(({ name, link }) => (
											<Link key={name} to={link}>
												{name}
											</Link>
										))}
									</td>

									<td>{formatFullDate(game.latestPlayDate)}</td>
									<td>{game.playCount}</td>
									<td>
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
								</tr>
							);
						})}
					</tbody>
					<tfoot>
						<tr>
							<td colSpan={9}></td>
						</tr>
					</tfoot>
				</table>
			</PendingContent>

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
			<Outlet />
		</>
	);
}
