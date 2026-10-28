import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import PageTitle from "../../components/page-title";
import { performancesQuery } from "./api";
import { CastingIcon } from "./CastingIcon";
import { MODULE_NAME } from "./constants";
import { formatShowDate } from "./utils";

export default function PerformanceList() {
	const { data: performances } = useSuspenseQuery(performancesQuery());

	let index = 1;
	return (
		<>
			<PageTitle title={`${MODULE_NAME} > Liste`} />
			<table className="list performances alternate">
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
								<td>
									<Link
										to="/shows/performances/$performanceId"
										params={{ performanceId: String(show.id) }}
									>
										{date}
									</Link>{" "}
									<span className="smalltext">{time}</span>
								</td>
								{/* <td>
									{date} <span className="smalltext">{time}</span>
								</td> */}
								<td>
									<b>
										<Link
											to="/shows/spectacles/$spectacleId"
											params={{ spectacleId: String(show.spectacleId) }}
										>
											{show.spectacle}
										</Link>
									</b>
								</td>
								<td>
									<Link to="/shows/places/$placeId" params={{ placeId: String(show.placeId) }}>
										{show.place}
									</Link>
								</td>
								<td>
									<span className={`fi fi-${show.country}`}></span>
								</td>
								<td>{show.seat ? <> 🎫 {show.seat}</> : ""}</td>
								<td>
									<CastingIcon {...show} />
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</>
	);
}
