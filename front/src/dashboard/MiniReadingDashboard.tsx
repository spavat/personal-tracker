import { useSuspenseQuery } from "@tanstack/react-query";

import { getBooks } from "../modules/reading-book/api";
import { getLongestConsecutiveStreak } from "../modules/reading-book/utils";
import { formatFullDate } from "../utils";

export default function MiniReadingDashboard({ year }: { year: string }) {
	const { data } = useSuspenseQuery({
		queryKey: ["reading", "books", year, "withReadingsDetails"],
		queryFn: () => getBooks({ from: `${year}-01-01`, to: `${year}-12-31`, withReadingsDetails: true }),
	});

	const completedBookData = data.reduce(
		(acc, book) => {
			book.readings.forEach((reading) => {
				if (reading.status === "complete" && reading.lastReadDate.substring(0, 4) === year) {
					acc.book += 1;
					acc.days += reading.readingDates.length;
				}
			});
			return acc;
		},
		{ book: 0, days: 0 },
	);
	const avgPerBook = Math.round(completedBookData.days / completedBookData.book);

	const inProgressBookData = data.reduce(
		(acc, book) => {
			book.readings.forEach((reading) => {
				if (reading.status === "in-progress" && reading.lastReadDate.substring(0, 4) !== year) {
					acc.book += 1;
				}
			});
			return acc;
		},
		{ book: 0 },
	);

	const streak = getLongestConsecutiveStreak(data);

	return (
		<div className="headlines">
			<div className="metric">
				<span className="name">Livres finis</span>
				<br />
				<span className="value">{completedBookData.book}</span>
				<br />
				<span className="info">(~{avgPerBook} jours par livre)</span>
			</div>

			<div className="metric">
				<span className="name">Plus longue série</span>
				<br />
				<span className="value">{streak.days} jours</span>
				<br />
				{streak.start && streak.end && (
					<span className="info">
						(du {formatFullDate(streak.start ?? "")} au {formatFullDate(streak.end ?? "")})
					</span>
				)}
			</div>

			<div className="metric">
				<span className="name">En cours</span>
				<br />
				<span className="value">{inProgressBookData.book}</span>
				<br />
			</div>
		</div>
	);
}
