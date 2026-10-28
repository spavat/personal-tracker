import { useSuspenseQuery } from "@tanstack/react-query";

import { getReport } from "../modules/reading-book/api";
import { formatFullDate } from "../utils";

export default function MiniReadingReport({ year }: { year: string }) {
	const { data } = useSuspenseQuery({
		queryKey: ["reading", "report", year],
		queryFn: () => getReport({ from: `${year}-01-01`, to: `${year}-12-31` }),
	});

	if (!data.hasData) {
		return <>Aucune donnée.</>;
	}

	const completeInfo = data.statusDistribution.find(({ name }) => name === "complete");
	const inProgressInfo = data.statusDistribution.find(({ name }) => name === "in-progress");
	const abandonedInfo = data.statusDistribution.find(({ name }) => name === "abandoned");
	return (
		<>
			<div className="headlines">
				<div className="metric">
					<span className="name">Livres finis</span>
					<br />
					<span className="value">{completeInfo?.books ?? 0}</span>
					<br />
					{completeInfo && <span className="info">(~{completeInfo?.averageDays ?? 0} jours par livre)</span>}
				</div>

				<div className="metric">
					<span className="name">Plus longue série</span>
					<br />
					<span className="value">{data.streakInfo.days} jours</span>
					<br />
					{data.streakInfo.start && data.streakInfo.end ? (
						<span className="info">
							(du {formatFullDate(data.streakInfo.start ?? "")} au{" "}
							{formatFullDate(data.streakInfo.end ?? "")})
						</span>
					) : (
						<></>
					)}
				</div>

				{inProgressInfo && (
					<div className="metric">
						<span className="name">En cours</span>
						<br />
						<span className="value">{inProgressInfo?.books ?? 0}</span>
						<br />
					</div>
				)}

				{abandonedInfo && (
					<div className="metric">
						<span className="name">Abandonné</span>
						<br />
						<span className="value">{abandonedInfo?.books ?? 0}</span>
						<br />
					</div>
				)}
			</div>
			<div className="headlines">
				{data.tagDistribution.length > 0 && (
					<div className="report_table">
						<span className="name">Contexte</span>
						<br />
						<table>
							<tbody>
								{data.tagDistribution.map((item, i) => (
									<tr key={item.name}>
										<td className="pos monospace smalltext">#{i + 1}.</td>
										<td>
											<b>{item.name}</b>
										</td>
										<td className="count">{Math.round(item.percent)} %</td>
										<td className="small_count">({item.chapters})</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				{data.langDistribution.length > 0 && (
					<div className="report_table">
						<span className="name">Langages</span>
						<br />
						<table>
							<tbody>
								{data.langDistribution.map((item, i) => (
									<tr key={item.name}>
										<td className="pos monospace smalltext">#{i + 1}.</td>
										<td>
											<b>{item.name}</b>
										</td>
										<td className="count">{Math.round(item.percent)} %</td>
										<td className="small_count">({item.chapters})</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				{data.authorDistribution.length > 0 && (
					<div className="report_table">
						<span className="name">Auteurs</span>
						<br />
						<table>
							<tbody>
								{data.authorDistribution.map((item, i) => (
									<tr key={item.name}>
										<td className="pos monospace smalltext">#{i + 1}.</td>
										<td>
											<b>{item.name}</b>
										</td>
										<td className="count">{item.books || "-"}</td>
										<td className="small_count">({item.chapters})</td>
										<td className="small_count">({item.days} jours uniques)</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</>
	);
}
