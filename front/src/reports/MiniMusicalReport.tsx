import { useSuspenseQuery } from "@tanstack/react-query";
import { Fragment } from "react/jsx-runtime";

import { getReport } from "../modules/show/api";

export default function MiniMusicalReport({ year }: { year: string }) {
	const { data } = useSuspenseQuery({
		queryKey: ["performances", "report", year],
		queryFn: () => getReport(`${year}-01-01`, `${year}-12-31`),
	});

	if (!data.hasData) {
		return <>Aucune donnée.</>;
	}
	return (
		<>
			<p>
				<b>{data.stats.spectacles}</b> spectacles pour <b>{data.stats.performances}</b> représentations
				<br />
				dont <b>{data.stats.newSpectacles}</b> nouveaux
				<br />
				{data.stats.countryDistribution.map(({ code, count }) => (
					<Fragment key={code}>
						<span className={`fi fi-${code}`}></span> {count}&nbsp;&nbsp;
					</Fragment>
				))}
			</p>
			<div className="headlines">
				<div className="report_table">
					<span className="name">Année</span>
					<br />
					<table>
						<tbody>
							{data.periodList.map((s, i) => {
								const rank = i === 0 || data.periodList[i - 1].rank !== s.rank ? `#${s.rank}` : "-";
								const isNew = s.isNew ? "🆕" : "";
								return (
									<tr key={s.name}>
										<td className="pos monospace smalltext">{rank}</td>
										<td>{isNew}</td>
										<td>
											<b>{s.name}</b>
										</td>
										<td className="count">+{s.count}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>

				<div className="report_table">
					<span className="name">Total</span>
					<br />
					<table>
						<tbody>
							{data.totalList.map((s, i) => {
								const rank = i === 0 || data.totalList[i - 1].rank !== s.rank ? `#${s.rank}` : "-";
								const diffView = s.added > 0 ? ` +${s.added}` : "";
								const isNew = s.isNew ? "🆕" : "";
								let diffPos = <></>;
								if (!s.isNew && s.move !== "") {
									if (s.move === "up") {
										diffPos = <i className="fa-solid fa-arrow-up green"></i>;
									} else {
										diffPos = <i className="fa-solid fa-arrow-down red"></i>;
									}
								}
								return (
									<tr key={s.name}>
										<td className="pos monospace smalltext">{rank}</td>
										<td>
											{isNew} {diffPos}
										</td>
										<td>
											<b>{s.name}</b>
										</td>
										<td>
											<span className="count">{s.count}</span>
											<span className="small">{diffView}</span>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}
