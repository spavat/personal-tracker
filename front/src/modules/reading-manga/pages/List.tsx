import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Fragment } from "react/jsx-runtime";

import { PendingContent } from "../../../components/pending-content";
import { useSortTable } from "../../../hooks/use-sort-table";
import { formatDate } from "../../../utils";
import { mangaListSort } from "../api";
import { getStatusIcon } from "../search-fn";

export default function List() {
	const navigate = useNavigate();
	const location = useLocation();
	const { query, headers, isPending } = useSortTable({
		...mangaListSort,
		columnsList: [
			null,
			{ name: "Statut", colName: "status", isSortable: true },
			{ name: "Titre", colName: "title", isSortable: true },
			{ name: "Auteur", colName: "author", isSortable: true },
			{ name: "Type", colName: "type", isSortable: true },
			{ name: "Links", colName: "links", isSortable: false },
			{ name: "Première", colName: "firstReadingDate", isSortable: true },
			{ name: "Dernière", colName: "lastReadingDate", isSortable: true },
			{ name: "Actions", colName: "", isSortable: false },
		],
	});

	return (
		<>
			<PendingContent isPending={isPending}>
				<table className="list mangas alternate responsive">
					<thead>
						<tr>{headers.map((h) => h)}</tr>
					</thead>
					<tbody>
						{query.data.map((manga, i) => {
							const status = getStatusIcon(manga, { color: true });
							const authors = manga.author ?? [];
							const arts = manga.art ?? [];
							const scenarios = manga.scenario ?? [];
							return (
								<tr key={manga.id}>
									<td className="smalltext">#{i + 1}</td>
									<td>{status}</td>
									<td>
										<Link to="/reading-manga/manga/$mangaId" params={{ mangaId: manga.id }}>
											{manga.title}
										</Link>
									</td>
									<td data-label="Auteur">
										{authors.length > 0 && authors.join(", ")}
										{arts.length > 0 && (
											<span>
												<i className="fa-solid fa-paintbrush"></i> : {arts.join(", ")}
											</span>
										)}
										<br />
										{scenarios.length > 0 && (
											<span>
												<i className="fa-regular fa-file-lines"></i> : {scenarios.join(", ")}
											</span>
										)}
									</td>
									<td data-label="Type">{manga.type}</td>
									<td data-label="Links">
										{manga.links &&
											manga.links.length > 0 &&
											manga.links.map((link) => (
												<Fragment key={link.name}>
													<a href={link.url} target="_blank" rel="noopener noreferrer">
														{link.name}
													</a>{" "}
												</Fragment>
											))}
									</td>
									<td data-label="Première">{formatDate(manga.firstReadingDate)}</td>
									<td data-label="Dernière">{formatDate(manga.lastReadingDate)}</td>
									<td data-label="Actions">
										<button
											type="button"
											title="Modifier"
											onClick={() =>
												navigate({
													to: "/reading-manga/list/$mangaId/edit",
													params: { mangaId: manga.id },
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: {
														to: "/reading-manga/list",
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
							<td colSpan={11}></td>
						</tr>
					</tfoot>
				</table>
			</PendingContent>
			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					title="Ajouter un manga"
					onClick={() =>
						navigate({
							to: "/reading-manga/list/add",
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: {
								to: "/reading-manga/list",
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
			<Outlet />
		</>
	);
}
