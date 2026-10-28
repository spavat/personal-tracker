import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import Badge from "../../components/badge";
import { PendingContent } from "../../components/pending-content";
import { useSortTable } from "../../hooks/use-sort-table";
import { formatFullDate, getDurationString } from "../../utils";
import { programListSort } from "./api";

const refsKeys = ["youtubeChannelId", "youtubePlaylistId", "rss"] as const;

export default function List() {
	const navigate = useNavigate();
	const location = useLocation();
	const { query, headers, isPending } = useSortTable({
		...programListSort,
		columnsList: [
			null,
			{ name: "Programme", colName: "name", isSortable: true },
			{ name: "Author", colName: "author", isSortable: true },
			{ name: "Réseau", colName: "network", isSortable: true },
			{ name: "Pays", colName: "country", isSortable: true },
			{ name: "Refs", colName: "", isSortable: false },
			{ name: "Dernière écoute", colName: "latestEpisodeDate", isSortable: true },
			{ name: "Episodes", colName: "episodeCount", isSortable: true },
			{ name: "Durée", colName: "totalDuration", isSortable: true },
			{ name: "Tags", colName: "", isSortable: false },
			{ name: "Art", colName: "", isSortable: false },
			{ name: "Actions", colName: "", isSortable: false },
		],
	});

	return (
		<>
			<PendingContent isPending={isPending}>
				<table className="list programs alternate">
					<thead>
						<tr>{headers.map((h) => h)}</tr>
					</thead>
					<tbody>
						{query.data.map((program, i) => {
							return (
								<tr key={program.id}>
									<td>{i + 1}</td>
									<td>
										<Link to="/internet/$programId" params={{ programId: program.id }}>
											{program.name}
										</Link>
									</td>
									<td>{program.author}</td>
									<td>{program.network}</td>
									<td>
										<span className={`fi fi-${program.country}`}></span>
									</td>
									<td>
										{refsKeys.map((key) => {
											const value = program.refs?.[key];
											if (value) {
												if (key === "youtubeChannelId") {
													return (
														<div key={key} className="tooltip">
															<i className="fa-brands fa-youtube"></i>
															<span className="tooltiptext">
																{value}
																<br />
																<a href={`https://www.youtube.com/channel/${value}`}>
																	Voir la chaine Youtube
																</a>
															</span>
														</div>
													);
												} else if (key === "youtubePlaylistId") {
													return (
														<div key={key} className="tooltip">
															<i className="fa-solid fa-list"></i>
															<span className="tooltiptext">
																{value}
																<br />
																<a
																	href={`https://www.youtube.com/playlist?list=${value}`}
																>
																	Voir la playlist Youtube
																</a>
															</span>
														</div>
													);
												} else if (key === "rss") {
													return (
														<div key={key} className="tooltip">
															<i className="fa-solid fa-rss"></i>
															<span className="tooltiptext">
																{value}
																<br />
																<a href={value}>Voir le flux RSS</a>
															</span>
														</div>
													);
												}
											} else {
												return <i key={key} className="disabled fa-solid fa-ban"></i>;
											}
										})}
									</td>
									<td>{formatFullDate(program.latestEpisodeDate)}</td>
									<td>{program.episodeCount}</td>
									<td>{getDurationString(program.totalDuration)}</td>
									<td>
										{program.tags?.map((t) => (
											<Badge
												key={t}
												icon="fa-solid fa-tag"
												name={t}
												color="white"
												backgroundColor="green"
											></Badge>
										))}
									</td>
									<td>
										<i
											className={`${!program.profile ? "disabled" : ""} fa-solid fa-circle-user`}
										></i>
										<i
											className={`${!program.banner ? "disabled" : ""} fa-solid fa-users-rectangle`}
										></i>
									</td>
									<td>
										<button
											type="button"
											title="Modifier"
											onClick={() =>
												navigate({
													to: "/internet/list/edit/$programId",
													params: { programId: program.id },
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: { to: "/internet/list" },
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
					title="Ajouter un programme"
					onClick={() =>
						navigate({
							to: "/internet/list/add",
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: { to: "/internet/list" },
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
