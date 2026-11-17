import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { useIsOwner } from "../../../hooks/use-is-owner";
import { authorDetailsQuery } from "../api";
import CardBook from "../components/CardBook";
import { coverSrc } from "../utils";

// A author and their books, in publication order
export default function AuthorDetails({ authorId }: { authorId: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();
	const { data: author } = useSuspenseQuery(authorDetailsQuery(authorId));

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
			<div className="grid">
				{author.books.map((book) => (
					<CardBook key={book.id} book={book} />
				))}
			</div>

			<Outlet />
		</div>
	);
}
