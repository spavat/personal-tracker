import { useSuspenseQuery } from "@tanstack/react-query";
import { Fragment } from "react";

import { getReport } from "../modules/music/api";
import { getDurationString } from "../utils";

export default function MiniMusicReport({ year }: { year: string }) {
	const { data } = useSuspenseQuery({
		queryKey: ["music", "report", year],
		queryFn: () => getReport(`${year}-01-01`, `${year}-12-31`),
	});

	if (!data.hasData) {
		return <>Aucune donnée.</>;
	}
	return (
		<>
			<div className="headlines">
				<div className="metric">
					<span className="name">Moyenne par jour</span>
					<br />
					<span className="value">{getDurationString(data.stats.averageDurationByDay)}</span>
					<br />
					<span className="info">({getDurationString(data.stats.totalDuration)})</span>
					<br />
				</div>

				<div className="metric">
					<span className="name">Artistes / Albums & EP</span>
					<br />
					<span className="value">
						{data.stats.artistsCount} / {data.stats.albumsCount}
					</span>
					<br />
				</div>
			</div>
			<div className="headlines">
				<div className="report_table">
					<span className="name">Artistes</span>
					<br />
					<table>
						<tbody>
							{data.artists.slice(0, 15).map((item, i) => (
								<tr key={item.name}>
									<td className="pos monospace smalltext">#{i + 1}.</td>
									<td>
										<b>{item.name}</b>
									</td>
									<td className="count">{getDurationString(item.duration)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<div className="report_table">
					<span className="name">Genres</span>
					<br />
					<table>
						<tbody>
							{data.genres.slice(0, 10).map((item, i) => (
								<Fragment key={item.name}>
									<tr>
										<td className="pos monospace smalltext">#{i + 1}.</td>
										<td>
											<b>{item.name}</b>
										</td>
										<td className="count">{getDurationString(item.duration)}</td>
									</tr>
									<tr>
										<td></td>
										<td colSpan={2}>
											{item.artists
												.slice(0, 5)
												.map((artist) => artist.name)
												.join(", ")}
										</td>
									</tr>
								</Fragment>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}
