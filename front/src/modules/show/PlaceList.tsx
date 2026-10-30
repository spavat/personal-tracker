import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { PendingContent } from "../../components/pending-content";
import { useIsOwner } from "../../hooks/use-is-owner";
import { useSortTable } from "../../hooks/use-sort-table";
import { placeListSort } from "./api";

export default function PlaceList() {
	const navigate = useNavigate();
	const isOwner = useIsOwner();
	const location = useLocation();
	const { query, headers, isPending } = useSortTable({
		...placeListSort,
		columnsList: [
			null,
			{ name: "Nom", colName: "name", isSortable: true },
			{ name: "Pays", colName: "country", isSortable: true },
			{ name: "Spectacle(s)", colName: "nbSpectacles", isSortable: true },
			{ name: "Représentation(s)", colName: "nbPerformances", isSortable: true },
			...(isOwner ? [{ name: "Actions", colName: "actions", isSortable: false }] : []),
		],
	});

	let index = 1;
	return (
		<>
			<h2>Lieux</h2>
			<PendingContent isPending={isPending}>
				<table className="list places alternate responsive">
					<thead>
						<tr>{headers.map((h) => h)}</tr>
					</thead>
					<tbody>
						{query.data.map((place) => (
							<tr key={`${place.id}`}>
								<td className="smalltext">#{index++}</td>
								<td>
									<b>
										<Link to="/shows/places/$placeId" params={{ placeId: String(place.id) }}>
											{place.name}
										</Link>
									</b>
								</td>
								<td data-label="Pays">
									<span className={`fi fi-${place.country}`}></span>
								</td>
								<td data-label="Spectacles">{place.nbSpectacles}</td>
								<td data-label="Représentations">{place.nbPerformances}</td>
								{isOwner && (
									<td data-label="Actions">
										<button
											type="button"
											title="Modifier"
											onClick={() =>
												navigate({
													to: "/shows/places/edit/$placeId",
													params: { placeId: String(place.id) },
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: {
														to: "/shows/places",
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
													to: "/shows/places/delete/$placeId",
													params: { placeId: String(place.id) },
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: {
														to: "/shows/places",
													},
												})
											}
											disabled={place.nbSpectacles > 0 || place.nbPerformances > 0}
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
						title="Ajouter un lieu"
						onClick={() =>
							navigate({
								to: "/shows/places/add",
								search: { returnTo: location.pathname },
								replace: true,
								resetScroll: false,
								mask: { to: "/shows/places" },
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
