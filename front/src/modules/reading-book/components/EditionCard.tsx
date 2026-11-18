import { type Book, creditName, type Edition } from "@personal-tracker/shared/reading-book";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { useIsOwner } from "../../../hooks/use-is-owner";
import { addReading } from "../api";
import { ReadingForm } from "../forms/ReadingForm";
import { coverSrc, EDITION_TYPE_LABELS } from "../utils";

export default function EditionCard({ book, edition }: { book: Book; edition: Edition }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();
	const addReadingMutation = useMutation({
		mutationFn: addReading,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reading", "books", book.id] });
		},
	});

	// the chapters its readings follow
	const model = book.models.find(({ id }) => id === edition.modelId)?.tree ?? [];

	const facts = [
		edition.publisher?.name,
		edition.collection,
		edition.type && EDITION_TYPE_LABELS[edition.type],
		edition.language,
		edition.pages !== null && `${edition.pages} pages`,
		edition.year,
	].filter(Boolean);

	function openModal(action: "edit" | "delete") {
		navigate({
			to:
				action === "edit"
					? "/reading-book/book/$bookId/edition/$editionId/edit"
					: "/reading-book/book/$bookId/edition/$editionId/delete",
			params: { bookId: book.id, editionId: edition.id },
			search: { returnTo: location.pathname },
			replace: true,
			resetScroll: false,
			mask: { to: "/reading-book/book/$bookId", params: { bookId: book.id } },
		});
	}

	return (
		<section className="edition">
			<div className="edition-info">
				{edition.cover ? (
					<img
						src={coverSrc(edition.cover)}
						alt={`Couverture de ${edition.title ?? book.book}`}
						className="cover"
					/>
				) : (
					<div className="cover cover-placeholder">
						<i className="fa-solid fa-book"></i>
					</div>
				)}
				<div>
					<h3>
						{/* the book's title is right above */}
						{edition.title ?? "Édition"}
						{isOwner && (
							<>
								<button type="button" title="Modifier l'édition" onClick={() => openModal("edit")}>
									<i className="fa-regular fa-pen-to-square"></i>
								</button>
								<button type="button" title="Supprimer l'édition" onClick={() => openModal("delete")}>
									<i className="fa-regular fa-trash-can"></i>
								</button>
							</>
						)}
					</h3>
					{facts.length > 0 && <p>{facts.join(" · ")}</p>}
					{edition.translators.length > 0 && (
						<p>Traduction : {edition.translators.map(creditName).join(", ")}</p>
					)}
					{edition.isbn && <p>ISBN : {edition.isbn}</p>}
				</div>
			</div>
			<div className="grid">
				{edition.readings.map((reading, i) => (
					<ReadingForm key={reading.id} index={i} reading={reading} bookId={book.id} model={model} />
				))}
				{isOwner && (
					<button
						type="button"
						className="card_item new-reading"
						disabled={addReadingMutation.isPending}
						onClick={() => addReadingMutation.mutate({ id: book.id, editionId: edition.id })}
					>
						+ Commencer une lecture
					</button>
				)}
			</div>
		</section>
	);
}
