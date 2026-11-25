import type { BookOverview } from "@personal-tracker/shared/reading-book";

import { Link } from "@tanstack/react-router";

import { seriesGroups } from "../utils";
import CardBook from "./CardBook";

// An author's books (in their order) under each of their series, the books in no series last.
// seriesHeading: the level of the series headings (h4 under a heading of its own); coverTransition: false when the
// books are shown elsewhere on the page (a transition name must be unique)
export default function AuthorBooks({
	books,
	seriesHeading: Heading = "h3",
	coverTransition = true,
}: {
	books: BookOverview[];
	seriesHeading?: "h3" | "h4";
	coverTransition?: boolean;
}) {
	const groups = seriesGroups(books);
	// the group where each book shows first (null: in no series)
	const firstSeries = new Map<string, string | null>();
	for (const group of groups) {
		for (const { book } of group.books) {
			if (!firstSeries.has(book.id)) firstSeries.set(book.id, group.series?.id ?? null);
		}
	}
	const inSomeSeries = books.some((book) => book.series.length);

	// a book in two series shows twice: only its first card takes the cover transition
	return groups.map(({ series, books: items }) => (
		<section key={series?.id ?? "none"}>
			{/* the books in no series come last, under their own heading when there are series */}
			{series ? (
				<Heading>
					<Link to="/reading-book/series/$seriesId" params={{ seriesId: series.id }}>
						{series.title}
					</Link>
				</Heading>
			) : (
				inSomeSeries && <Heading>Hors série</Heading>
			)}
			<div className="grid">
				{items.map(({ book, label }) => (
					<CardBook
						key={book.id}
						book={book}
						label={label}
						coverTransition={coverTransition && firstSeries.get(book.id) === (series?.id ?? null)}
					/>
				))}
			</div>
		</section>
	));
}
