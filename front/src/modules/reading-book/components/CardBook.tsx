import { BookOverview, creditName } from "@personal-tracker/shared/reading-book";
import { Link } from "@tanstack/react-router";

import { formatDate } from "../../../utils";
import { coverSrc, getStatusIcon } from "../utils";
import SeriesPath from "./SeriesPath";

// label: the book's label in the series shown ("1", "interlude"…); readingOrder: its "#n" in the whole series
export default function CardBook({
	book,
	label,
	readingOrder,
	coverTransition = true,
}: {
	book: BookOverview;
	label?: string | null;
	readingOrder?: number;
	// false when the book is shown twice on the page: a transition name must be unique
	coverTransition?: boolean;
}) {
	return (
		<div className="card_item">
			{book.cover && (
				<img
					src={coverSrc(book.cover)}
					alt=""
					className="card-cover"
					// moves to the same cover on the book page
					style={coverTransition ? { viewTransitionName: `edition-cover-${book.editionId}` } : undefined}
				/>
			)}
			{readingOrder !== undefined && <span className="reading-order smalltext">#{readingOrder}</span>}
			{label && <span className="series-label">{label}</span>}
			<span className="title">
				<Link to="/reading-book/book/$bookId" params={{ bookId: book.id }} viewTransition>
					{/* the title of the edition shown by the cover, else the book's */}
					{book.editionTitle ?? book.book}
				</Link>
			</span>
			{book.originalYear !== null && ` (${book.originalYear})`} -{" "}
			<span className="subtitle">{book.authors.map(creditName).join(", ")}</span>
			{book.series.map((series) => (
				<div key={series.id} className="smalltext">
					<SeriesPath series={series} />
				</div>
			))}
			{!book.series.length && <br />}
			{/* a single reading is shown as is; several are folded under their count */}
			{book.readings.length === 1 && <ReadingLine reading={book.readings[0]} />}
			{book.readings.length > 1 && (
				<details open>
					<summary>{book.readings.length} lectures</summary>
					{book.readings.map((reading, i) => (
						<ReadingLine key={reading.id} reading={reading} index={i + 1} />
					))}
				</details>
			)}
		</div>
	);
}

// status, first and last day, number of days; its number when the book has several readings
function ReadingLine({ reading, index }: { reading: BookOverview["readings"][number]; index?: number }) {
	return (
		<p className="monospace">
			{index !== undefined && <span className="smalltext">#{index} : </span>}
			{getStatusIcon(reading, { color: true })} {formatDate(reading.firstReadDate)} -{" "}
			{formatDate(reading.lastReadDate)} - {reading.readingDates.length} jour
			{reading.readingDates.length > 1 ? "s" : ""}
		</p>
	);
}
