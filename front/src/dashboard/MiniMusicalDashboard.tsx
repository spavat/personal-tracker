import { useSuspenseQuery } from "@tanstack/react-query";

import { getPerformances } from "../modules/show/api";

export default function MiniMusicalDashboard({ year }: { year: string }) {
	const now = Temporal.Now.plainDateISO();

	const { data } = useSuspenseQuery({
		queryKey: ["performances", year],
		queryFn: () => getPerformances(`${year}-01-01`, `${year}-12-31`),
	});

	const reps = data.reduce(
		(acc, show) => {
			if (show.date.substring(0, 4) !== year) {
				return acc;
			}
			const showDate = Temporal.PlainDate.from(show.date);
			if (Temporal.PlainDate.compare(showDate, now) < 0) {
				acc.past += 1;
				acc.setPast.add(show.spectacle);
			} else {
				acc.future += 1;
				acc.setFuture.add(show.spectacle);
			}
			return acc;
		},
		{ past: 0, future: 0, setPast: new Set(), setFuture: new Set() },
	);

	return (
		<div className="headlines">
			<div className="metric">
				<span className="name">Passés</span>
				<br />
				<span className="value">{reps.past}</span>
				<br />
				<span className="info">{reps.setPast.size} spectacles</span>
			</div>

			<div className="metric">
				<span className="name">Prévus</span>
				<br />
				<span className="value">{reps.future}</span>
				<br />
				<span className="info">{reps.setFuture.size} spectacles</span>
			</div>
		</div>
	);
}
