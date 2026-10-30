import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { addReading, bookDetailsQuery } from "./api";
import { ReadingForm } from "./forms/ReadingForm";
import { renderItemModel } from "./render-modele-fn";

export default function BookDetails({ bookId }: { bookId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const location = useLocation();
	const addReadingMutation = useMutation({
		mutationFn: addReading,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reading", "books", bookId] });
		},
	});

	const { data: book } = useSuspenseQuery(bookDetailsQuery(bookId));

	function addNewReading() {
		if (bookId) {
			addReadingMutation.mutate({ id: bookId });
		}
	}

	return (
		<div className="details">
			<div className="presentation">
				<div className="title">
					<h2>
						{book.book}
						<button
							type="button"
							title="Modifier"
							onClick={() =>
								navigate({
									to: "/reading-book/book/$bookId/edit",
									params: { bookId: book.id },
									search: { returnTo: location.pathname },
									mask: { to: "/reading-book/book/$bookId", params: { bookId: book.id } },
								})
							}
						>
							<i className="fa-regular fa-pen-to-square"></i>
						</button>
					</h2>
				</div>
				<div className="general">
					<div>
						<span>
							Auteur.ic.es: <b>{(book.author ?? []).join(", ")}</b>
						</span>
						<br />
						Langage : {book.language}
						<br />
						Pays : {book.country} <span className={`fi fi-${book.country}`}></span> <br />
						Pages : {book.pages !== null && `${book.pages} pages`}
					</div>
				</div>
				<div className="stats"></div>
			</div>
			<h2>Lectures</h2>
			<div className="grid">
				{book.readings?.map((reading, i) => (
					<ReadingForm
						key={reading.id}
						index={i}
						reading={reading}
						bookId={bookId ?? ""}
						model={book.model}
					/>
				))}
				<button type="button" className="card_item new-reading" onClick={addNewReading}>
					+ Commencer une lecture
				</button>
			</div>

			<h2>
				Modele
				<button
					type="button"
					title="Modifier"
					onClick={() =>
						navigate({
							to: "/reading-book/book/$bookId/model",
							params: { bookId: book.id },
							search: { returnTo: location.pathname },
						})
					}
				>
					<i className="fa-regular fa-pen-to-square"></i>
				</button>
			</h2>
			<div className="grid">
				<div className="card_item">
					<h3>Modèle</h3>
					<ul className="book-tree root">
						<li>
							<details open>
								<summary>Table des matières</summary>
								<ul>
									{book.model?.map((readingModele) => {
										return renderItemModel(readingModele);
									})}
								</ul>
							</details>
						</li>
					</ul>
				</div>
			</div>

			<Outlet />
		</div>
	);
}
