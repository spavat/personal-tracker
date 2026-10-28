import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import PageTitle from "../../components/page-title";
import { PendingContent } from "../../components/pending-content";
import { useIsOwner } from "../../hooks/use-is-owner";
import { useSortTable } from "../../hooks/use-sort-table";
import { artistListSort } from "./api";
import { MODULE_NAME } from "./constants";

export default function ArtistList() {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();
	const { query, headers, isPending } = useSortTable({
		...artistListSort,
		columnsList: [
			null,
			{ name: "Nom", colName: "name", isSortable: true },
			{ name: "Spectacle(s)", colName: "nbSpectacles", isSortable: true },
			{ name: "Représentation(s)", colName: "nbPerformances", isSortable: true },
			...(isOwner ? [{ name: "Actions", colName: "actions", isSortable: false }] : []),
		],
	});

	let index = 1;
	return (
		<>
			<PageTitle title={`${MODULE_NAME} > Artistes`} />
			<h2>Artistes</h2>
			<PendingContent isPending={isPending}>
				<table className="list artists alternate">
					<thead>
						<tr>{headers.map((h) => h)}</tr>
					</thead>
					<tbody>
						{query.data.map((artist) => (
							<tr key={artist.id}>
								<td className="smalltext">#{index++}</td>
								<td>
									<b>
										<Link to="/shows/artists/$artistId" params={{ artistId: String(artist.id) }}>
											{artist.name}
										</Link>
									</b>
								</td>
								<td>{artist.nbSpectacles}</td>
								<td>{artist.nbPerformances}</td>
								{isOwner && (
									<td>
										<button
											type="button"
											title="Modifier"
											onClick={() =>
												navigate({
													to: "/shows/artists/edit/$artistId",
													params: { artistId: String(artist.id) },
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: {
														to: "/shows/artists",
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
													to: "/shows/artists/delete/$artistId",
													params: { artistId: String(artist.id) },
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: {
														to: "/shows/artists",
													},
												})
											}
											disabled={artist.nbSpectacles > 0 || artist.nbPerformances > 0}
										>
											<i className="fa-regular fa-trash-can"></i>
										</button>
									</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
			</PendingContent>

			<Outlet />
			{isOwner && (
				<div className="fab-container">
					<button
						type="button"
						className="fab-main"
						aria-label="Ajouter un artiste"
						onClick={() =>
							navigate({
								to: "/shows/artists/add",
								search: { returnTo: location.pathname },
								replace: true,
								resetScroll: false,
								mask: { to: "/shows/artists" },
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
		</>
	);
}
