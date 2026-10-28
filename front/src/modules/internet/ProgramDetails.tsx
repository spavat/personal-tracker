import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import Badge from "../../components/badge";
import { API_BASE_URL } from "../../config";
import { formatDate, formatDateTime, formatDay, getDurationString, getPeriodDifference } from "../../utils";
import { programDetailsQuery } from "./api";
import { getIconType } from "./search-fn";

function getDomain(url: string) {
	try {
		return new URL(url).hostname.split(".").slice(-2).join(".");
	} catch {
		return url;
	}
}

export default function ProgramDetails({ programId }: { programId: string }) {
	const navigate = useNavigate();
	const location = useLocation();

	function goToCreationModal() {
		navigate({
			to: "/internet/$programId/add",
			params: { programId },
			search: { returnTo: location.pathname },
			replace: true,
			resetScroll: false,
			mask: { to: "/internet/$programId", params: { programId } },
		});
	}

	useHotkeys("ctrl+shift+n", (e) => {
		e.preventDefault();
		goToCreationModal();
	});

	const { data: program } = useSuspenseQuery(programDetailsQuery(programId));

	const [openedEpisodes, setOpenedEpisodes] = useState(new Set<string>());
	function toggleSecondRow(id: string) {
		setOpenedEpisodes((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}

	return (
		<>
			{program.banner && <img src={`${API_BASE_URL}${program.banner}`} alt="" className="program-banner" />}
			<div className="presentation">
				<div className="title">
					<h2>
						{program.name} {program.shortName && <span className="subTitle">({program.shortName})</span>}{" "}
						<button
							type="button"
							title="Modifier"
							onClick={() =>
								navigate({
									to: "/internet/$programId/edit",
									params: { programId: program.id },
									search: { returnTo: location.pathname },
									replace: true,
									resetScroll: false,
									mask: { to: "/internet/$programId", params: { programId: program.id } },
								})
							}
						>
							<i className="fa-regular fa-pen-to-square"></i>
						</button>
					</h2>
				</div>

				<div className="general">
					{program.profile && (
						<div className="profile">
							<img src={`${API_BASE_URL}${program.profile}`} alt="" className="program-profile" />
						</div>
					)}
					<div>
						{program.author && (
							<>
								<span>
									par : <b>{program.author}</b>
								</span>
								<br />
							</>
						)}
						{program.network && (
							<>
								<span>
									Réseau : <b>{program.network}</b>
								</span>
								<br />
							</>
						)}
						{program.country && (
							<>
								<span>
									Pays : <span className={`fi fi-${program.country}`}></span>
								</span>
								<br />
							</>
						)}
						{program.type && (
							<>
								<span>
									Type : {getIconType(program)}&nbsp;
									{program.type}
								</span>
								<br />
							</>
						)}
						{(program.links ?? []).length > 0 && (
							<>
								<span>
									Liens:{" "}
									{program.links?.map((l) => {
										return (
											<a key={l} href={l}>
												{getDomain(l)}
											</a>
										);
									})}
								</span>
								<br />
							</>
						)}
						{(program.tags ?? []).length > 0 && (
							<>
								<span>
									Tags :{" "}
									{program.tags?.map((t) => (
										<Badge
											key={t}
											icon="fa-solid fa-tag"
											name={t}
											color="white"
											backgroundColor="green"
										></Badge>
									))}
								</span>
							</>
						)}
					</div>
				</div>
				<div className="description">{program.description && <>{program.description}</>}</div>
				<div className="stats">
					<div>
						<span>
							<i className="fa-solid fa-list"></i> <strong>{program.details.episodes}</strong> épisodes
						</span>
						<br />
						<span>
							<i className="fa-solid fa-clock"></i> Durée moyenne :{" "}
							<strong>{getDurationString(program.details.averageLength)}</strong>
						</span>
						<br />
						<span>
							<i className="fa-solid fa-check"></i> Taux de complétion :{" "}
							<strong>{program.details.completionRate}%</strong>
						</span>
						<br />
						<span>
							<i className="fa-solid fa-calendar"></i> Dernier épisode :{" "}
							<strong>
								{getPeriodDifference(program.details.lastSeenDate)} (
								<strong>{formatDate(program.details.lastSeenDate)}</strong>)
							</strong>
						</span>
						<br />
					</div>
				</div>
			</div>

			<table className="list episodes alternate responsive">
				<thead>
					<tr data-title="Épisodes">
						<th></th>
						<th colSpan={2}>Date</th>
						<th>Nom</th>
						<th>Tags</th>
						<th>Durée</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{program.episodes.map((episode) => {
						const isOpened = openedEpisodes.has(episode.id);
						const notFull = Boolean(episode.durationReal);
						return (
							<Fragment key={episode.id}>
								<tr>
									<td data-label="Type" onClick={() => toggleSecondRow(episode.id)}>
										{episode.type === "video" && <i className="fa-solid fa-video"></i>}
										{episode.type === "podcast" && <i className="fa-solid fa-podcast"></i>}
										{episode.type === "live" && <i className="fa-solid fa-play"></i>}
										{episode.type === "radio" && <i className="fa-solid fa-radio"></i>}
									</td>
									<td data-label="Jour">{formatDay(episode.date)}</td>
									<td data-label="Date">{formatDate(episode.date)}</td>
									<td>
										{episode.name}
										{episode.comment && (
											<>
												<span
													className="tooltip-anchor"
													style={{ anchorName: `--comment-${episode.id}` }}
												>
													<i className="fa-solid fa-circle-info"></i>
												</span>
												<span
													className="tooltip-content"
													style={{ positionAnchor: `--comment-${episode.id}` }}
												>
													{episode.comment}
												</span>
											</>
										)}
									</td>
									<td data-label="Tags">
										{(episode.tags ?? []).map((c: string) => (
											<Badge
												key={c}
												icon="fa-solid fa-tag"
												name={c}
												color="white"
												backgroundColor="green"
											></Badge>
										))}
										{(episode.contextTags ?? []).map((c: string) => (
											<Badge
												key={c}
												icon="fa-solid fa-tag"
												name={c}
												color="white"
												backgroundColor="darkgrey"
											></Badge>
										))}
									</td>
									<td data-label="Durée">
										{getDurationString(episode.durationReal ?? episode.duration)}
										{notFull ? "*" : ""}
									</td>
									<td data-label="Actions">
										<button
											type="button"
											title="Modifier"
											onClick={() =>
												navigate({
													to: "/internet/$programId/episode/$episodeId/edit",
													params: { programId, episodeId: episode.id },
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: { to: "/internet/$programId", params: { programId } },
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
													to: "/internet/$programId/episode/$episodeId/delete",
													params: { programId, episodeId: episode.id },
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: { to: "/internet/$programId", params: { programId } },
												})
											}
										>
											<i className="fa-regular fa-trash-can"></i>
										</button>
									</td>
								</tr>
								{isOpened && (
									<tr>
										<td></td>
										<td data-label="Date de création" colSpan={2} className="smalltext">
											{formatDateTime(episode.created)}
										</td>
										<td data-label="Lien">
											<i className="fa-solid fa-link"></i> Lien :{" "}
											<a href={episode.link}>{episode.link}</a>
										</td>
										<td></td>
										<td></td>
									</tr>
								)}
							</Fragment>
						);
					})}
				</tbody>
				<tfoot></tfoot>
			</table>

			<div className="fab-container">
				<button type="button" className="fab-main" onClick={goToCreationModal} title="Ajouter un épisode">
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
