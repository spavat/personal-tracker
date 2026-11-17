import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { PendingContent } from "../../../components/PendingContent";
import TagBadge from "../../../components/TagBadge";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { useSortTable } from "../../../hooks/use-sort-table";
import { formatFullDate, getDurationString } from "../../../utils";
import { programListSort } from "../api";

const refsKeys = ["youtubeChannelId", "youtubePlaylistId", "rss"] as const;

export default function ProgramList() {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();
	const { query, headers, isPending } = useSortTable({
		...programListSort,
		columnsList: [
			{ name: "", isSortable: false, className: "cell-index" },
			{ name: "Programme", colName: "name", isSortable: true, className: "cell-text" },
			{ name: "Author", colName: "author", isSortable: true, className: "cell-text col-author" },
			{ name: "Réseau", colName: "network", isSortable: true, className: "cell-text col-network" },
			{ name: "Pays", colName: "country", isSortable: true, className: "cell-icon" },
			{ name: "Refs", colName: "", isSortable: false, className: "cell-icon" },
			{ name: "Dernière écoute", colName: "latestEpisodeDate", isSortable: true, className: "cell-date" },
			{ name: "Episodes", colName: "episodeCount", isSortable: true, className: "cell-number col-episodes" },
			{ name: "Durée", colName: "totalDuration", isSortable: true, className: "cell-duration col-duration" },
			{ name: "Tags", colName: "", isSortable: false, className: "cell-text col-tags" },
			{ name: "Art", colName: "", isSortable: false, className: "cell-icon" },
			...(isOwner ? [{ name: "Actions", colName: "", isSortable: false }] : []),
		],
	});

	return (
		<>
			<PendingContent isPending={isPending}>
				<table className="list programs alternate responsive">
					<thead>
						<tr>{headers.map((h) => h)}</tr>
					</thead>
					<tbody>
						{query.data.map((program, i) => {
							return (
								<tr key={program.id}>
									<td className="cell-index">{i + 1}</td>
									<td className="cell-text">
										<Link
											to="/internet/$programId"
											params={{ programId: program.id }}
											viewTransition
										>
											{program.name}
											{program.private && (
												<>
													{" "}
													<i className="fa-solid fa-mask" title="Privé"></i>
												</>
											)}
										</Link>
									</td>
									{/* no network: the author takes its cell too */}
									<td className="cell-text" data-label="Author" colSpan={program.network ? 1 : 2}>
										{program.author}
									</td>
									{program.network && (
										<td className="cell-text" data-label="Réseau">
											{program.network}
										</td>
									)}
									<td className="cell-icon" data-label="Pays">
										<span className={`fi fi-${program.country}`}></span>
									</td>
									<td className="cell-icon" data-label="Refs">
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
									<td className="cell-date" data-label="Dernière écoute">
										{formatFullDate(program.latestEpisodeDate)}
									</td>
									<td className="cell-number" data-label="Episodes">
										{program.episodeCount}
									</td>
									<td className="cell-duration" data-label="Durée">
										{getDurationString(program.totalDuration)}
									</td>
									<td className="cell-text" data-label="Tags">
										{program.tags?.map((t) => (
											<TagBadge key={t} name={t} />
										))}
									</td>
									<td className="cell-icon" data-label="Art">
										<i
											className={`${!program.profile ? "disabled" : ""} fa-solid fa-circle-user`}
										></i>
										<i
											className={`${!program.banner ? "disabled" : ""} fa-solid fa-users-rectangle`}
										></i>
									</td>
									{isOwner && (
										<td data-label="Actions">
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
									)}
								</tr>
							);
						})}
					</tbody>
				</table>
			</PendingContent>

			{isOwner && (
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
			)}
			<Outlet />
		</>
	);
}
