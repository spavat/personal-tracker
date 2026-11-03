import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import DisplaySelector from "../../../components/DisplaySelector";
import PageTitle from "../../../components/PageTitle";
import { useDisplay } from "../../../hooks/use-display";
import { performancesQuery } from "../api";
import Card from "../components/CardPerformance";
import { CastingIcon } from "../components/CastingIcon";
import { MODULE_NAME } from "../constants";
import { formatShowDate, mediaSrc } from "../utils";

export default function PerformanceList() {
	const { data: performances } = useSuspenseQuery(performancesQuery());

	const [display, changeDisplay] = useDisplay("show_performance_list_display");

	let index = 1;
	return (
		<>
			<PageTitle title={`${MODULE_NAME} > Représentations`} />
			<h2>
				Représentations ({performances.filter((p) => !p.canceled).length})
				<DisplaySelector value={display} onChange={changeDisplay} />
			</h2>

			{display === "list" ? (
				<table className="list performances alternate responsive">
					<thead>
						<tr>
							<th></th>
							<th>Date</th>
							<th>Spectacle</th>
							<th>Lieu</th>
							<th>Pays</th>
							<th>Place</th>
							<th>Casting</th>
						</tr>
					</thead>
					<tbody>
						{performances.map((show) => {
							const [date, time] = formatShowDate(show.date).split(" ");
							return (
								<tr key={show.id} className={show.canceled ? "canceled" : ""}>
									<td className="smalltext">{!show.canceled && <>#{index++}</>}</td>
									<td data-label="Date">
										<Link
											to="/shows/performances/$performanceId"
											params={{ performanceId: String(show.id) }}
											viewTransition
										>
											{date}
										</Link>{" "}
										<span className="smalltext">{time}</span>
									</td>
									<td>
										<b>
											<Link
												to="/shows/spectacles/$spectacleId"
												params={{ spectacleId: String(show.spectacle.id) }}
												viewTransition
											>
												{show.posterUrl && (
													<img
														src={mediaSrc(show.posterUrl)}
														alt=""
														className="poster-thumb in-list"
														style={{ viewTransitionName: `poster-${show.id}` }}
														loading="lazy"
													/>
												)}
												{show.spectacle.name}
											</Link>
										</b>
									</td>
									<td data-label="Lieu">
										<Link
											to="/shows/places/$placeId"
											params={{ placeId: String(show.place?.id) }}
											viewTransition
										>
											{show.place?.name}
										</Link>
									</td>
									<td data-label="Pays">
										<span className={`fi fi-${show.place?.country}`}></span>
									</td>
									<td data-label="Place">{show.seat ? <> 🎫 {show.seat}</> : ""}</td>
									<td data-label="Casting">
										<CastingIcon {...show} />
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			) : (
				<div className="grid">
					{(performances ?? []).map((perf) => {
						return <Card key={perf.id} performance={perf} />;
					})}
				</div>
			)}
		</>
	);
}
