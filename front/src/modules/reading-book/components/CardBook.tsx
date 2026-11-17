import { BookOverview, creditName } from "@personal-tracker/shared/reading-book";
import { Link } from "@tanstack/react-router";

import { formatDate } from "../../../utils";
import { coverSrc, getStatusIcon } from "../utils";

export default function CardBook({ book }: { book: BookOverview }) {
	return (
		<div className="card_item">
			{book.cover && <img src={coverSrc(book.cover)} alt="" className="card-cover" />}
			<span className="title">
				<Link to="/reading-book/book/$bookId" params={{ bookId: book.id }}>
					{book.book}
				</Link>
			</span>{" "}
			- <span className="subtitle">{book.authors.map(creditName).join(", ")}</span>
			<br />
			{book.readings.length > 0 && (
				<details open>
					<summary>
						{book.readings.length} lecture{book.readings.length > 1 ? "s" : ""}
					</summary>
					{book.readings.map((reading, i) => (
						<p key={reading.id} className="monospace">
							<span className="smalltext">#{i + 1}</span> : {getStatusIcon(reading, { color: true })}{" "}
							{formatDate(reading.firstReadDate)} - {formatDate(reading.lastReadDate)} -{" "}
							{reading.readingDates.length} jour
							{reading.readingDates.length > 1 ? "s" : ""}
						</p>
					))}
				</details>
			)}
		</div>
	);
}
