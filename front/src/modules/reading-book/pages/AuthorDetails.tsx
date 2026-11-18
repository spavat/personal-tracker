import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { useIsOwner } from "../../../hooks/use-is-owner";
import { authorDetailsQuery } from "../api";
import CardBook from "../components/CardBook";
import { coverSrc, seriesGroups } from "../utils";

// A author and their books, in publication order
export default function AuthorDetails({ authorId }: { authorId: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();
	const { data: author } = useSuspenseQuery(authorDetailsQuery(authorId));
	const groups = seriesGroups(author.books);
	// the group where each book shows first (null: in no series)
	const firstSeries = new Map<string, string | null>();
	for (const { series, books } of groups) {
		for (const { book } of books) {
			if (!firstSeries.has(book.id)) firstSeries.set(book.id, series?.id ?? null);
		}
	}

	return (
		<div className="details">
			{/* same layout and classes as the show artist page */}
			<div className="presentation-with-picture">
				<div className="picture">
					{author.picture ? (
						<img
							src={coverSrc(author.picture)}
							alt={`Portrait de ${author.name}`}
							className="artist-picture"
							style={{ viewTransitionName: `author-portrait-${author.id}` }}
						/>
					) : (
						<div className="portrait-card">
							<i className="fa-solid fa-user"></i>
						</div>
					)}
				</div>
				<div className="general">
					<div className="title">
						<h2>
							{author.name}
							{isOwner && (
								<button
									type="button"
									title="Modifier"
									onClick={() =>
										navigate({
											to: "/reading-book/authors/$authorId/edit",
											params: { authorId },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
											mask: { to: "/reading-book/authors/$authorId", params: { authorId } },
										})
									}
								>
									<i className="fa-regular fa-pen-to-square"></i>
								</button>
							)}
						</h2>
					</div>
					<span>
						<i className="fa-solid fa-book"></i> <strong>{author.books.length}</strong> livre
						{author.books.length > 1 ? "s" : ""}
					</span>
				</div>
			</div>
			<h2>Liste des livres</h2>
			{/* a book in two series shows twice: only its first card takes the cover transition */}
			{groups.map(({ series, books }) => (
				<section key={series?.id ?? "none"}>
					{/* the books in no series come last, under their own heading when there are series */}
					{series ? (
						<h3>
							<Link to="/reading-book/series/$seriesId" params={{ seriesId: series.id }}>
								{series.title}
							</Link>
						</h3>
					) : (
						author.books.some((book) => book.series.length) && <h3>Hors série</h3>
					)}
					<div className="grid">
						{books.map(({ book, label }) => (
							<CardBook
								key={book.id}
								book={book}
								label={label}
								coverTransition={firstSeries.get(book.id) === (series?.id ?? null)}
							/>
						))}
					</div>
				</section>
			))}

			<Outlet />
		</div>
	);
}
