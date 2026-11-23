import { type LookupEdition, normalizeIsbn } from "@personal-tracker/shared/reading-book";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { ApiError } from "../../../api-utils";
import { languageName } from "../../../utils";
import { lookupEditionQuery, lookupWorkEditionsQuery } from "../api";
import { EDITION_TYPE_LABELS } from "../utils";

const ALL = "";

// Finds an edition on Open Library to fill in the edition form: among the editions of the book's work (when the
// book was found there), or by ISBN. `initialIsbn` is looked up when the form opens, and its edition picked.
export default function EditionLookup({
	workId,
	defaultLanguage,
	initialIsbn,
	onPick,
	onClear,
}: {
	workId: string | undefined;
	defaultLanguage: string;
	initialIsbn?: string;
	onPick: (edition: LookupEdition) => void;
	// the edition picked is dropped ("Changer", a new search): the form no longer comes from it
	onClear: () => void;
}) {
	const [isbnText, setIsbnText] = useState(initialIsbn ?? "");
	const [isbn, setIsbn] = useState<string | null>(initialIsbn ? normalizeIsbn(initialIsbn) : null);
	const [language, setLanguage] = useState(defaultLanguage);
	const [picked, setPicked] = useState<LookupEdition | null>(null);

	const editions = useQuery({ ...lookupWorkEditionsQuery("openLibrary", workId ?? ""), enabled: !!workId });
	const byIsbn = useQuery({ ...lookupEditionQuery("openLibrary", isbn ?? ""), enabled: isbn !== null });

	function pick(edition: LookupEdition) {
		onPick(edition);
		setPicked(edition);
	}

	// the ISBN given when the form opens: its edition is picked as soon as it's found
	const autoPicked = useRef(false);
	useEffect(() => {
		if (initialIsbn && byIsbn.data && !autoPicked.current) {
			autoPicked.current = true;
			pick(byIsbn.data);
		}
	});

	function searchIsbn() {
		setIsbn(normalizeIsbn(isbnText));
		unpick();
	}

	function unpick() {
		if (picked) {
			onClear();
		}
		setPicked(null);
	}

	const languages = [...new Set((editions.data ?? []).flatMap(({ language }) => (language ? [language] : [])))]
		.map((code) => ({ code, name: languageName(code) }))
		.toSorted((a, b) => a.name.localeCompare(b.name));
	// in the language chosen: an edition without a language is kept
	const shown = (editions.data ?? []).filter(
		(edition) => !language || !edition.language || edition.language === language,
	);
	const isbnNotFound = byIsbn.error instanceof ApiError && byIsbn.error.status === 404;

	return (
		<div className="panel book-lookup">
			<h3>Rechercher sur Open Library</h3>
			<div className="full-fields-row">
				<input
					type="text"
					className="flex"
					value={isbnText}
					onChange={(e) => setIsbnText(e.target.value)}
					onKeyDown={(e) => {
						// Enter searches: the field is inside the edition form, which it must not submit
						if (e.key === "Enter") {
							e.preventDefault();
							searchIsbn();
						}
					}}
					placeholder="ISBN"
					aria-label="ISBN à rechercher"
					autoComplete="off"
				/>
				<button type="button" onClick={searchIsbn} disabled={byIsbn.isFetching}>
					<i className="fa-solid fa-magnifying-glass"></i> Rechercher
				</button>
			</div>
			{isbnText.trim() !== "" && normalizeIsbn(isbnText) === null && (
				<p className="smalltext">Un ISBN a 10 ou 13 chiffres</p>
			)}
			{byIsbn.isFetching && <p className="smalltext">Recherche…</p>}
			{isbnNotFound && <p className="smalltext">Aucune édition pour cet ISBN</p>}
			{byIsbn.error && !isbnNotFound && <p className="error">Erreur : {byIsbn.error.message}</p>}
			{picked ? (
				<p className="smalltext">
					Rempli depuis Open Library : <b>{editionSummary(picked)}</b>{" "}
					<button type="button" onClick={unpick}>
						Changer
					</button>
				</p>
			) : (
				<>
					{byIsbn.data && !byIsbn.isFetching && <EditionList editions={[byIsbn.data]} onPick={pick} />}
					{workId && (
						<>
							<div className="full-fields-row lookup-filter">
								<span>Éditions de ce livre</span>
								<select
									value={language}
									onChange={(e) => setLanguage(e.target.value)}
									aria-label="Langue des éditions"
								>
									<option value={ALL}>Toutes les langues</option>
									{/* the book's language, even without an edition in it */}
									{language && !languages.some(({ code }) => code === language) && (
										<option value={language}>{languageName(language)}</option>
									)}
									{languages.map(({ code, name }) => (
										<option key={code} value={code}>
											{name}
										</option>
									))}
								</select>
							</div>
							{editions.isFetching && <p className="smalltext">Chargement des éditions…</p>}
							{editions.error && <p className="error">Erreur : {editions.error.message}</p>}
							{editions.data &&
								(shown.length ? (
									<EditionList editions={shown} onPick={pick} />
								) : (
									<p className="smalltext">Aucune édition dans cette langue</p>
								))}
						</>
					)}
				</>
			)}
		</div>
	);
}

function EditionList({ editions, onPick }: { editions: LookupEdition[]; onPick: (edition: LookupEdition) => void }) {
	return (
		<ul className="lookup-results">
			{editions.map((edition) => (
				<li key={edition.externalId}>
					<button
						type="button"
						onClick={() => onPick(edition)}
						aria-label={`Choisir ${editionSummary(edition)}`}
					>
						{edition.cover ? (
							<img src={edition.cover} alt="" loading="lazy" />
						) : (
							<span className="lookup-cover-placeholder">📖</span>
						)}
						<span>
							<b>{edition.title ?? "Sans titre"}</b>
							<br />
							{[
								edition.publisher?.name,
								edition.type && EDITION_TYPE_LABELS[edition.type],
								edition.language && languageName(edition.language),
								edition.year,
								edition.isbn,
							]
								.filter(Boolean)
								.join(" · ")}
						</span>
					</button>
				</li>
			))}
		</ul>
	);
}

// "L'étranger (Gallimard, 1984)"
function editionSummary(edition: LookupEdition) {
	const details = [edition.publisher?.name, edition.year].filter(Boolean).join(", ");
	return `${edition.title ?? "Sans titre"}${details ? ` (${details})` : ""}`;
}
