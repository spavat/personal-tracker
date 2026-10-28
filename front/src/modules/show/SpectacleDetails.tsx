import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Fragment, useState } from "react";

import { useIsOwner } from "../../hooks/use-is-owner";
import { spectacleDetailsQuery } from "./api";
import { CastingIcon } from "./CastingIcon";
import { formatShowDate } from "./utils";

export default function SpectacleDetails({ spectacleId }: { spectacleId: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();

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

	let index = 1;
	return (
		<>
			<div className="presentation">
				<div className="title">
					<h2>{details.name} </h2>
				</div>
				<div className="general"></div>
				<div className="description"></div>
				<div className="stats">
					<div></div>
				</div>
			</div>

			<div className="base_content">
				<h3>Représentations ({details.performances?.length})</h3>
				<table className="list performances alternate">
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
						{(details.performances ?? []).map((perf: any) => {
							const isOpened = openedEpisodes.has(perf.id);
							const [date, time] = formatShowDate(perf.date).split(" ");
							return (
								<Fragment key={perf.id}>
									<tr className={perf.canceled ? "canceled" : ""}>
										<td onClick={() => toggleSecondRow(perf.id)} className="smalltext">
											{!perf.canceled && <>#{index++}</>}
										</td>
										<td>
											{date} <span className="smalltext">{time}</span>
										</td>
										<td>
											<Link
												to="/shows/performances/$performanceId"
												params={{ performanceId: String(perf.id) }}
											>
												{details.name}
											</Link>
										</td>
										<td>
											<Link
												to="/shows/places/$placeId"
												params={{ placeId: String(perf.place.id) }}
											>
												{perf.place.name}
											</Link>
										</td>
										<td>
											<span className={`fi fi-${perf.place.country}`}></span>
										</td>
										<td>{perf.seat ? <> 🎫 {perf.seat}</> : ""}</td>
										<td onClick={() => toggleSecondRow(perf.id)}>
											<CastingIcon {...perf} />
										</td>
									</tr>
									{perf.cast.length > 0 && isOpened && (
										<tr>
											<td></td>
											<td></td>
											<td colSpan={5}>
												{perf.cast.map((role: any) => (
													<li key={role.artist_id}>
														<Link
															to="/shows/artists/$artistId"
															params={{ artistId: String(role.artist_id) }}
														>
															{role.artist_name}
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
			</div>

			{details.models.length > 0 && (
				<>
					<div className="base_content">
						<h3>Modèles</h3>
						{details.models.map((model: any) => {
							return (
								<div key={model.id} className="card_item">
									{model.name}{" "}
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
															modelId: model.id,
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
															modelId: model.id,
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
									<details>
										<summary>
											{model.roles.length} rôle{model.roles.length > 1 ? "s" : ""}
										</summary>
										{model.roles.map((role: any) => {
											return (
												<li key={role.id}>
													{role.name}{" "}
													{role.artistId ? (
														<>
															:{" "}
															<Link
																to="/shows/artists/$artistId"
																params={{ artistId: String(role.artistId) }}
															>
																{role.artistName}
															</Link>
														</>
													) : (
														""
													)}
												</li>
											);
										})}
									</details>
								</div>
							);
						})}
					</div>
				</>
			)}

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
