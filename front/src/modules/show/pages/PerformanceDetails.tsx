import { PerformanceDetailsResponse } from "@personal-tracker/shared/show";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useLocation } from "@tanstack/react-router";

import DisplaySelector from "../../../components/DisplaySelector";
import PageTitle from "../../../components/PageTitle";
import { useDisplay } from "../../../hooks/use-display";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { performanceDetailsQuery } from "../api";
import CardArtist from "../components/CardArtist";
import { MODULE_NAME } from "../constants";
import { formatShowDate, mediaSrc, posterRibbon } from "../utils";

export default function PerformanceDetails({ performanceId }: { performanceId: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();

	const { data } = useSuspenseQuery(performanceDetailsQuery(performanceId));
	const details: PerformanceDetailsResponse = data;

	const [display, changeDisplay] = useDisplay("show_performance_details_display");

	const hasRoles = (details?.roles ?? []).length > 0;
	const [date, time] = formatShowDate(details?.date ?? "").split(" ");

	return (
		<>
			<PageTitle title={`${MODULE_NAME} > Représentation > ${details.spectacle.name} - ${date} à ${time}`} />
			<div className="presentation-with-picture">
				<div className="picture">
					{details.posterUrl && (
						<div className={`poster-frame ${posterRibbon(details)}`}>
							<img
								src={mediaSrc(details.posterUrl)}
								alt="Affiche"
								className="poster"
								style={{ viewTransitionName: `poster-${details.id}` }}
							/>
						</div>
					)}
				</div>
				<div className="general">
					<div className="title">
						<h2>
							<Link
								to="/shows/spectacles/$spectacleId"
								params={{ spectacleId: String(details.spectacle.id) }}
								viewTransition
							>
								{details.spectacle.name}
							</Link>
							{isOwner && (
								<>
									<button
										type="button"
										title="Modifier"
										onClick={() =>
											navigate({
												to: "/shows/performances/$performanceId/edit",
												params: { performanceId },
												search: { returnTo: location.pathname },
												replace: true,
												resetScroll: false,
												mask: {
													to: "/shows/performances/$performanceId",
													params: { performanceId },
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
												to: "/shows/performances/$performanceId/delete",
												params: { performanceId },
												search: { returnTo: location.pathname },
												replace: true,
												resetScroll: false,
												mask: {
													to: "/shows/performances/$performanceId",
													params: { performanceId },
												},
											})
										}
									>
										<i className="fa-regular fa-trash-can"></i>
									</button>
								</>
							)}
						</h2>
					</div>

					<div style={{ whiteSpace: "pre-wrap" }}>
						{details.place && (
							<>
								<span>Lieu : {details.place.name}</span>{" "}
								<span className={`fi fi-${details.place.country}`}></span>
								<br />
							</>
						)}
						<span>
							Date : {date} à {time}
						</span>
						<br />
						<span>Place : 🎫 {details.seat}</span>
					</div>
				</div>
			</div>
			<div className="base_content">
				<h3>
					Casting
					{isOwner && (
						<button
							type="button"
							onClick={() =>
								navigate({
									to: "/shows/performances/$performanceId/casting",
									params: { performanceId: performanceId },
									search: { returnTo: location.pathname },
									replace: true,
									resetScroll: false,
									mask: {
										to: "/shows/performances/$performanceId",
										params: { performanceId: performanceId },
									},
								})
							}
						>
							{hasRoles ? "Editer le casting" : "Ajouter le casting"}
						</button>
					)}
					{hasRoles && <DisplaySelector value={display} onChange={changeDisplay} />}
				</h3>

				{hasRoles && (
					<>
						{display === "list" ? (
							<table className="list casting alternate responsive">
								<thead>
									<tr>
										<th></th>
										<th>Nom</th>
										<th>Artist</th>
										<th>Divers</th>
									</tr>
								</thead>
								<tbody>
									{(details.roles ?? []).map((role, index) => (
										<tr key={role.id}>
											<td className="smalltext">#{index + 1}</td>
											<td>{role.name}</td>
											<td data-label="Artiste">
												<Link
													to="/shows/artists/$artistId"
													params={{ artistId: String(role.artist.id) }}
												>
													{role.pictureUrl && (
														<img
															src={mediaSrc(role.pictureUrl)}
															alt=""
															className="portrait-thumb in-list"
															loading="lazy"
														/>
													)}
													{role.artist.name}
												</Link>
											</td>
											<td data-label="Statut">{role.status}</td>
										</tr>
									))}
								</tbody>
								<tfoot></tfoot>
							</table>
						) : (
							<div className="grid artists">
								{(details.roles ?? []).map((role) => (
									<CardArtist key={role.id} artist={role.artist} pictureUrl={role.pictureUrl}>
										{role.name}{" "}
										{role.status && (
											<div>
												<i>{role.status}</i>
											</div>
										)}
									</CardArtist>
								))}
							</div>
						)}
						<p>Casting: {details.casting_status}</p>
						<p>Origine: {details.casting_origin}</p>
					</>
				)}
				{!hasRoles && <p>Aucun casting</p>}
			</div>

			<Outlet />
		</>
	);
}
