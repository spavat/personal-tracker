import { type LookupWork, normalizeIsbn } from "@personal-tracker/shared/reading-book";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { lookupWorksQuery } from "../api";

type Query = { isbn: string } | { title: string; author?: string };

// Searches Open Library for a book, by title (and author) or by ISBN, to fill in the book form. `onClear`: the
// result picked is dropped ("Changer", a new search), the form no longer comes from it
export default function BookLookup({
	onPick,
	onClear,
}: {
	onPick: (work: LookupWork, isbn: string | null) => void;
	onClear: () => void;
}) {
	const [text, setText] = useState("");
	const [author, setAuthor] = useState("");
	const [query, setQuery] = useState<Query | null>(null);
	const [picked, setPicked] = useState<string | null>(null);
	const {
		data: works,
		error,
		isFetching,
	} = useQuery({
		...lookupWorksQuery("openLibrary", query ?? { title: "" }),
		enabled: query !== null,
	});

	function search() {
		const isbn = normalizeIsbn(text);
		if (isbn) {
			setQuery({ isbn });
		} else if (text.trim()) {
			setQuery({ title: text.trim(), ...(author.trim() && { author: author.trim() }) });
		}
		unpick();
	}

	function unpick() {
		if (picked) {
			onClear();
		}
		setPicked(null);
	}

	// Enter searches: the field is inside the book form, which it must not submit
	function onKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			search();
		}
	}

	function pick(work: LookupWork) {
		onPick(work, query && "isbn" in query ? query.isbn : null);
		setPicked(work.title);
	}

	return (
		<div className="panel book-lookup">
			<h3>Rechercher sur Open Library</h3>
			<div className="full-fields-row">
				<input
					type="text"
					className="flex"
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={onKeyDown}
					placeholder="Titre ou ISBN"
					aria-label="Titre ou ISBN"
					autoComplete="off"
				/>
				<input
					type="text"
					value={author}
					onChange={(e) => setAuthor(e.target.value)}
					onKeyDown={onKeyDown}
					placeholder="Auteur (facultatif)"
					aria-label="Auteur (facultatif)"
					autoComplete="off"
					disabled={normalizeIsbn(text) !== null}
				/>
				<button type="button" onClick={search} disabled={isFetching}>
					<i className="fa-solid fa-magnifying-glass"></i> Rechercher
				</button>
			</div>
			{isFetching && <p className="smalltext">Recherche…</p>}
			{error && <p className="error">Erreur : {error.message}</p>}
			{picked ? (
				<p className="smalltext">
					Rempli depuis Open Library : <b>{picked}</b>{" "}
					<button type="button" onClick={unpick}>
						Changer
					</button>
				</p>
			) : (
				works &&
				!isFetching &&
				(works.length === 0 ? (
					<p className="smalltext">Aucun résultat</p>
				) : (
					<ul className="lookup-results">
						{works.map((work) => (
							<li key={work.externalId}>
								<button type="button" onClick={() => pick(work)} aria-label={`Choisir ${work.title}`}>
									{work.cover ? (
										<img src={work.cover} alt="" loading="lazy" />
									) : (
										<span className="lookup-cover-placeholder">📖</span>
									)}
									<span>
										<b>{work.title}</b>
										<br />
										{work.authors.map(({ name }) => name).join(", ")}
										{work.originalYear !== null && ` · ${work.originalYear}`}
									</span>
								</button>
							</li>
						))}
					</ul>
				))
			)}
		</div>
	);
}
