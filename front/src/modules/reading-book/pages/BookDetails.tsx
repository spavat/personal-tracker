import { creditName } from "@personal-tracker/shared/reading-book";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { useIsOwner } from "../../../hooks/use-is-owner";
import { bookDetailsQuery } from "../api";
import EditionCard from "../components/EditionCard";
import SeriesPath from "../components/SeriesPath";
import { renderItemModel, truncateModel } from "../render-modele-fn";

export default function BookDetails({ bookId }: { bookId: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();

	const { data: book } = useSuspenseQuery(bookDetailsQuery(bookId));

	return (
		<div className="details">
			<div className="presentation">
				<div className="title">
					<h2>
						{book.book}
						{isOwner && (
							<button
								type="button"
								title="Modifier"
								onClick={() =>
									navigate({
										to: "/reading-book/book/$bookId/edit",
										params: { bookId: book.id },
										search: { returnTo: location.pathname },
										replace: true,
										resetScroll: false,
										mask: { to: "/reading-book/book/$bookId", params: { bookId: book.id } },
									})
								}
							>
								<i className="fa-regular fa-pen-to-square"></i>
							</button>
						)}
					</h2>
				</div>
				<div className="general">
					<div>
						<span>
							Auteur.ic.es:{" "}
							<b>
								{book.authors.map((author, i) => (
									<span key={author.entityId}>
										{i > 0 && ", "}
										<Link
											to="/reading-book/authors/$authorId"
											params={{ authorId: author.entityId }}
										>
											{creditName(author)}
										</Link>
									</span>
								))}
							</b>
						</span>
						<br />
						Langue originale : {book.originalLanguage}
						<br />
						{book.originalYear !== null && (
							<>
								Année de publication : {book.originalYear}
								<br />
							</>
						)}
						Pays : {book.country} <span className={`fi fi-${book.country}`}></span>
						{book.series.map((series) => (
							<span key={series.id}>
								<br />
								Série : <SeriesPath series={series} />
							</span>
						))}
					</div>
				</div>
				<div className="stats"></div>
			</div>
			<h2>
				Éditions
				{isOwner && (
					<button
						type="button"
						title="Ajouter une édition"
						onClick={() =>
							navigate({
								to: "/reading-book/book/$bookId/edition/add",
								params: { bookId: book.id },
								search: { returnTo: location.pathname },
								replace: true,
								resetScroll: false,
								mask: { to: "/reading-book/book/$bookId", params: { bookId: book.id } },
							})
						}
					>
						<i className="fa-solid fa-plus"></i>
					</button>
				)}
			</h2>
			{book.editions.map((edition) => (
				<EditionCard key={edition.id} book={book} edition={edition} />
			))}

			<h2>
				Modèles
				{isOwner && (
					<button
						type="button"
						title="Ajouter un modèle"
						onClick={() =>
							navigate({
								to: "/reading-book/book/$bookId/model/add",
								params: { bookId: book.id },
								search: { returnTo: location.pathname },
								replace: true,
								resetScroll: false,
								mask: { to: "/reading-book/book/$bookId", params: { bookId: book.id } },
							})
						}
					>
						<i className="fa-solid fa-plus"></i>
					</button>
				)}
			</h2>
			<div className="grid">
				{book.models.map((model) => {
					const editions = book.editions.filter((edition) => edition.modelId === model.id);
					const modelParams = { bookId: book.id, modelId: model.id };
					return (
						<div key={model.id} className="card_item model">
							<h3>
								{model.name}
								{isOwner && (
									<>
										<button
											type="button"
											title="Modifier le modèle"
											onClick={() =>
												navigate({
													to: "/reading-book/book/$bookId/model/$modelId/edit",
													params: modelParams,
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: {
														to: "/reading-book/book/$bookId",
														params: { bookId: book.id },
													},
												})
											}
										>
											<i className="fa-regular fa-pen-to-square"></i>
										</button>
										<button
											type="button"
											title="Supprimer le modèle"
											onClick={() =>
												navigate({
													to: "/reading-book/book/$bookId/model/$modelId/delete",
													params: modelParams,
													search: { returnTo: location.pathname },
													replace: true,
													resetScroll: false,
													mask: {
														to: "/reading-book/book/$bookId",
														params: { bookId: book.id },
													},
												})
											}
										>
											<i className="fa-regular fa-trash-can"></i>
										</button>
									</>
								)}
							</h3>
							{editions.length > 0 && (
								<p>Utilisé par : {editions.map((edition) => edition.title ?? "Édition").join(", ")}</p>
							)}
							<ul className="book-tree root">
								<li>
									<details open>
										<summary>Table des matières</summary>
										<ul>{truncateModel(model.tree, 5).map((item) => renderItemModel(item))}</ul>
									</details>
								</li>
							</ul>
						</div>
					);
				})}
			</div>

			<Outlet />
		</div>
	);
}
