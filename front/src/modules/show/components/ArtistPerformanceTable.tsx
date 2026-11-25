import type { ArtistDetailsResponse } from "@personal-tracker/shared/show";

import { Link } from "@tanstack/react-router";
import { Fragment } from "react/jsx-runtime";

import { formatShowDate, mediaSrc } from "../utils";

// An artist's performances with their role, oldest first, under their spectacle when grouped
export default function ArtistPerformanceTable({
	groups,
	groupBySpectacle,
}: {
	groups: ArtistDetailsResponse["groups"];
	groupBySpectacle: boolean;
}) {
	let index = 1;
	return (
		<table className="list performancesWithRole alternate responsive">
			<thead>
				<tr>
					<th className="cell-index"></th>
					<th className="cell-date">Date</th>
					<th className="cell-text">Spectacle</th>
					<th className="cell-text">Role</th>
					<th className="cell-text">Lieu</th>
					<th className="cell-icon">Pays</th>
					<th className="cell-text">Place</th>
				</tr>
			</thead>
			<tbody>
				{groups.map((spectacle) => (
					<Fragment key={spectacle.id ?? "spectacle"}>
						{groupBySpectacle && (
							<tr>
								<td colSpan={7}>
									<span className="title">{spectacle.name}</span>{" "}
									<span className="subtitle">
										{spectacle.performances.length > 1 && <>({spectacle.performances.length})</>}
									</span>
								</td>
							</tr>
						)}

						{spectacle.performances.map((perf) => {
							const [date, time] = formatShowDate(perf.date).split(" ");
							return (
								<tr key={perf.id} className={perf.canceled ? "canceled" : ""}>
									<td className="cell-index">{!perf.canceled && index++}</td>
									<td className="cell-date" data-label="Date">
										<Link
											to="/shows/performances/$performanceId"
											params={{ performanceId: String(perf.id) }}
											viewTransition
										>
											{date}
										</Link>{" "}
										<span className="smalltext">{time}</span>
									</td>
									<td className="cell-text">
										{perf.posterUrl && (
											<img
												src={mediaSrc(perf.posterUrl)}
												alt=""
												className="poster-thumb in-list"
												style={{ viewTransitionName: `poster-${perf.id}` }}
												loading="lazy"
											/>
										)}
										<Link
											to="/shows/spectacles/$spectacleId"
											params={{ spectacleId: String(perf.spectacle.id) }}
											viewTransition
										>
											{perf.spectacle.name}
										</Link>
									</td>
									<td className="cell-text" data-label="Rôle">
										{perf.role}
									</td>
									<td className="cell-text" data-label="Lieu">
										{perf.place && (
											<Link
												to="/shows/places/$placeId"
												params={{ placeId: String(perf.place.id) }}
												viewTransition
											>
												{perf.place.name}
											</Link>
										)}
									</td>
									<td className="cell-icon" data-label="Pays">
										<span className={`fi fi-${perf.place?.country}`}></span>
									</td>
									<td className="cell-text" data-label="Place">
										{perf.seat ? <> 🎫 {perf.seat}</> : ""}
									</td>
								</tr>
							);
						})}
					</Fragment>
				))}
			</tbody>
		</table>
	);
}
