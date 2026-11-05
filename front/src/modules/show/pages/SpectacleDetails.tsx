import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import Markdown from "react-markdown";

import DisplaySelector from "../../../components/DisplaySelector";
import PageTitle from "../../../components/PageTitle";
import { useDisplay } from "../../../hooks/use-display";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { spectacleDetailsQuery } from "../api";
import Card from "../components/CardPerformance";
import { CastingIcon } from "../components/CastingIcon";
import MediaGallery from "../components/MediaGallery";
import { MODULE_NAME } from "../constants";
import { formatShowDate, mediaSrc } from "../utils";

export default function SpectacleDetails({ spectacleId }: { spectacleId: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();

	const [display, changeDisplay] = useDisplay("show_spectacle_details_display");

	const { data: details } = useSuspenseQuery(spectacleDetailsQuery(spectacleId));

	const [openedEpisodes, setOpenedEpisodes] = useState<Set<number>>(() => new Set());
	function toggleSecondRow(id: number) {
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

	const tracklistRef = useRef<HTMLDivElement>(null);
	const [tracklistOpen, setTracklistOpen] = useState(false);
	const [tracklistOverflows, setTracklistOverflows] = useState(false);
	useLayoutEffect(() => {
		const el = tracklistRef.current;
		setTracklistOverflows(el !== null && el.scrollHeight > el.clientHeight);
	}, [details.tracklist]);

	let index = 1;
	return (
		<>
			<PageTitle title={`${MODULE_NAME} > Spectacle > ${details.name}`} />
			<div className="presentation">
				<div className="title">
					<h2>
						{details.name}
						{isOwner && (
							<button
								type="button"
								title="Modifier"
								onClick={() =>
									navigate({
										to: "/shows/spectacles/$spectacleId/edit",
										params: { spectacleId },
										search: { returnTo: location.pathname },
										replace: true,
										resetScroll: false,
										mask: {
											to: "/shows/spectacles/$spectacleId",
											params: { spectacleId },
										},
									})
								}
							>
								<i className="fa-regular fa-pen-to-square"></i>
							</button>
						)}
					</h2>
				</div>
				<div className="general">
					{(details.links ?? []).length > 0 && (
						<ul className="spectacle-links">
							{details.links?.map((link) => (
								<li key={link.url}>
									<a href={link.url} target="_blank" rel="noreferrer">
										<i className="fa-solid fa-arrow-up-right-from-square"></i> {link.label}
									</a>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>

			{details.description && (
				<div className="base_content">
					<h3>Description</h3>
					<div className="description" style={{ whiteSpace: "pre-wrap" }}>
						{details.description}
						{details.descriptionSource && (
							<>
								{" "}
								<a
									href={details.descriptionSource}
									target="_blank"
									rel="noreferrer"
									className="smalltext"
								>
									(source)
								</a>
							</>
						)}
					</div>
				</div>
			)}

			<div className="base_content">
				<h3>
					Représentations ({details.performances?.length})
					<DisplaySelector value={display} onChange={changeDisplay} />
				</h3>
				{display === "list" ? (
					<table className="list performances alternate responsive">
						<thead>
							<tr>
								<th></th>
								<th>Date</th>
								<th>Performance</th>
								<th>Lieu</th>
								<th>Pays</th>
								<th>Place</th>
								<th>Casting</th>
							</tr>
						</thead>
						<tbody>
							{details.performances.map((perf) => {
								const isOpened = openedEpisodes.has(perf.id);
								const [date, time] = formatShowDate(perf.date).split(" ");
								return (
									<Fragment key={perf.id}>
										<tr className={perf.canceled ? "canceled" : ""}>
											<td onClick={() => toggleSecondRow(perf.id)} className="smalltext">
												{!perf.canceled && <>#{index++}</>}
											</td>
											<td data-label="Date">
												{date} <span className="smalltext">{time}</span>
											</td>
											<td>
												<Link
													to="/shows/performances/$performanceId"
													params={{ performanceId: String(perf.id) }}
													viewTransition
												>
													{perf.posterUrl && (
														<img
															src={mediaSrc(perf.posterUrl)}
															alt=""
															className="poster-thumb in-list"
															style={{ viewTransitionName: `poster-${perf.id}` }}
															loading="lazy"
														/>
													)}
													{details.name}
												</Link>
											</td>
											<td data-label="Lieu">
												<Link
													to="/shows/places/$placeId"
													params={{ placeId: String(perf.place?.id) }}
													viewTransition
												>
													{perf.place?.name}
												</Link>
											</td>
											<td data-label="Pays">
												<span className={`fi fi-${perf.place?.country}`}></span>
											</td>
											<td data-label="Place">{perf.seat ? <> 🎫 {perf.seat}</> : ""}</td>
											<td data-label="Casting" onClick={() => toggleSecondRow(perf.id)}>
												<CastingIcon {...perf} />
											</td>
										</tr>
										{(perf.roles ?? []).length > 0 && isOpened && (
											<tr>
												<td></td>
												<td></td>
												<td colSpan={5}>
													{(perf.roles ?? []).map((role) => (
														<li key={role.id}>
															{role.pictureUrl && (
																<img
																	src={mediaSrc(role.pictureUrl)}
																	alt=""
																	className="portrait-thumb"
																	loading="lazy"
																/>
															)}
															<Link
																to="/shows/artists/$artistId"
																params={{ artistId: String(role.artist.id) }}
															>
																{role.artist.name}
															</Link>{" "}
															- {role.name} {role.status && <>({role.status})</>}
														</li>
													))}
												</td>
											</tr>
										)}
									</Fragment>
								);
							})}
						</tbody>
						<tfoot></tfoot>
					</table>
				) : (
					<div className="grid">
						{details.performances.map((perf) => {
							return <Card key={perf.id} performance={perf} />;
						})}
					</div>
				)}
			</div>

			{isOwner && (
				<MediaGallery
					owner={{ spectacleId: details.id }}
					cropAspect={2 / 3}
					media={details.media}
					invalidateKey={["shows", "spectacles", spectacleId]}
				/>
			)}

			<div className="tracklist-models">
				{details.tracklist && (
					<div className="base_content">
						<h3>Tracklist</h3>
						<div
							ref={tracklistRef}
							className={`tracklist ${tracklistOpen ? "open" : ""} ${tracklistOverflows ? "overflows" : ""}`}
						>
							<Markdown components={{ h1: "h4", h2: "h5" }}>{details.tracklist}</Markdown>
						</div>
						{tracklistOverflows && !tracklistOpen && (
							<button type="button" className="tracklist-toggle" onClick={() => setTracklistOpen(true)}>
								Ouvrir
							</button>
						)}
					</div>
				)}

				{details.models.length > 0 && (
					<div className="base_content">
						<h3>Modèles</h3>
						<div className="grid">
							{details.models.map((model) => {
								return (
									<div key={model.id} className="card_item">
										<h4>
											{model.name}
											{isOwner && (
												<>
													<button
														type="button"
														title="Modifier"
														onClick={() =>
															navigate({
																to: "/shows/spectacles/$spectacleId/editModel/$modelId",
																params: {
																	spectacleId,
																	modelId: String(model.id),
																},
																search: { returnTo: location.pathname },
																replace: true,
																resetScroll: false,
																mask: {
																	to: "/shows/spectacles/$spectacleId",
																	params: {
																		spectacleId,
																	},
																},
															})
														}
													>
														<i className="fa-regular fa-pen-to-square"></i>
													</button>
													<button
														type="button"
														title="Supprimer"
														onClick={() =>
															navigate({
																to: "/shows/spectacles/$spectacleId/deleteModel/$modelId",
																params: {
																	spectacleId,
																	modelId: String(model.id),
																},
																search: { returnTo: location.pathname },
																replace: true,
																resetScroll: false,
																mask: {
																	to: "/shows/spectacles/$spectacleId",
																	params: {
																		spectacleId,
																	},
																},
															})
														}
													>
														<i className="fa-regular fa-trash-can"></i>
													</button>
												</>
											)}
										</h4>
										<details>
											<summary>
												{model.roles.length} rôle{model.roles.length > 1 ? "s" : ""}
											</summary>
											<ul>
												{model.roles.map((role) => {
													return (
														<li key={role.id}>
															{role.name}{" "}
															{role.artist ? (
																<>
																	:{" "}
																	<Link
																		to="/shows/artists/$artistId"
																		params={{ artistId: String(role.artist.id) }}
																	>
																		{role.artist.name}
																	</Link>
																</>
															) : (
																""
															)}
														</li>
													);
												})}
											</ul>
										</details>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</div>

			{isOwner && (
				<div className="fab-container">
					<button
						type="button"
						className="fab-main"
						title="Ajouter une représentation"
						onClick={() =>
							navigate({
								to: "/shows/spectacles/$spectacleId/addPerformance",
								params: {
									spectacleId,
								},
								search: { returnTo: location.pathname },
								replace: true,
								resetScroll: false,
								mask: {
									to: "/shows/spectacles/$spectacleId",
									params: {
										spectacleId,
									},
								},
							})
						}
					>
						<div className="pulse"></div>
						<div className="heart-line">
							<i className="fa-regular fa-calendar-plus"></i>
						</div>
					</button>
					<button
						type="button"
						className="fab-main"
						title="Ajouter un modèle"
						onClick={() =>
							navigate({
								to: "/shows/spectacles/$spectacleId/addModel",
								params: {
									spectacleId,
								},
								search: { returnTo: location.pathname },
								replace: true,
								resetScroll: false,
								mask: {
									to: "/shows/spectacles/$spectacleId",
									params: {
										spectacleId,
									},
								},
							})
						}
					>
						<div className="pulse"></div>
						<div className="heart-line">
							<i className="fa-solid fa-table-list"></i>
						</div>
					</button>
				</div>
			)}

			<Outlet />
		</>
	);
}
