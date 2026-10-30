import { PerformanceDetailsResponse } from "@personal-tracker/shared/show";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useLocation } from "@tanstack/react-router";

import { useIsOwner } from "../../hooks/use-is-owner";
import { performanceDetailsQuery } from "./api";
import { formatShowDate } from "./utils";

export default function PerformanceDetails({ performanceId }: { performanceId: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();

	const { data } = useSuspenseQuery(performanceDetailsQuery(performanceId));
	const details: PerformanceDetailsResponse = data;

	const hasRoles = (details?.roles ?? []).length > 0;
	const [date, time] = formatShowDate(details?.date ?? "").split(" ");

	return (
		<>
			<div className="presentation">
				<div className="title">
					<h2>
						{details.spectacle.name}
						{isOwner && (
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
						)}
					</h2>
				</div>
				<div className="general">
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
					</div>
				</div>
				<div className="description"></div>
				<div className="stats">
					<div>
						<span>Place : 🎫 {details.seat}</span>
						<br />
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
				</h3>

				{hasRoles && (
					<>
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
								{(details.roles ?? []).map((role: any, index: number) => (
									<tr key={role.id}>
										<td className="smalltext">#{index + 1}</td>
										<td>{role.name}</td>
										<td data-label="Artiste">
											<Link
												to="/shows/artists/$artistId"
												params={{ artistId: String(role.artistId) }}
											>
												{role.artistName}
											</Link>
										</td>
										<td data-label="Statut">{role.status}</td>
									</tr>
								))}
							</tbody>
							<tfoot></tfoot>
						</table>
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
