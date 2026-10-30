import { Reading } from "@personal-tracker/shared/reading-manga";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import { Fragment } from "react/jsx-runtime";

import Badge from "../../../components/badge";
import MutationError from "../../../components/mutation-error";
import { useStoredValue } from "../../../hooks/stored-value";
import { formatDate, formatDay, getCurrentOrPreviousDate } from "../../../utils";
import { mangaDetailsQuery, save } from "../api";
import { FrontManga } from "../types";
import { getMangaPrefixName, getNextReadingName, getReadingForQuickAdd, mergeReadings } from "../utils";

export default function MangaDetails({ mangaId }: { mangaId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const location = useLocation();

	useHotkeys("ctrl+shift+n", (e) => {
		e.preventDefault();
		navigate({
			to: "/reading-manga/manga/$mangaId/reading/add",
			params: { mangaId },
			search: { returnTo: location.pathname },
			replace: true,
			resetScroll: false,
		});
	});

	const [groupReadings, setGroupReadings] = useStoredValue("reading_manga_details_groupReadings", false);
	function changeGroupReadings(e: React.ChangeEvent<HTMLInputElement>) {
		setGroupReadings(e.target.checked);
	}

	const { data: book } = useSuspenseQuery(mangaDetailsQuery(mangaId));

	const saveMutation = useMutation({
		mutationFn: save,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reading", "mangas"] });
			queryClient.invalidateQueries({ queryKey: ["reading", "manga", mangaId] });
		},
	});

	const readings: Array<FrontManga.MergedReading> = groupReadings
		? mergeReadings(book.readings, { sort: "desc" })
		: book.readings;
	function quickAddReading(reading: Reading) {
		const { id, ...rest } = reading;
		saveMutation.mutate({
			mangaId: mangaId ?? "",
			reading: {
				...rest,
				date: getCurrentOrPreviousDate(),
				name: getNextReadingName(reading.name),
			},
		});
	}

	const authors = book.author ?? [];
	const artists = book.art ?? [];
	const scenarists = book.scenario ?? [];

	return (
		<div className="details">
			<div className="presentation">
				<div className="title">
					<h2>
						{book.title}
						<button
							type="button"
							title="Modifier le manga"
							onClick={() =>
								navigate({
									to: "/reading-manga/manga/$mangaId/edit",
									params: { mangaId },
									search: { returnTo: location.pathname },
									replace: true,
									resetScroll: false,
									mask: {
										to: "/reading-manga/manga/$mangaId",
										params: { mangaId },
									},
								})
							}
						>
							<i className="fa-regular fa-pen-to-square"></i>
						</button>
					</h2>
					{book.titleEnglish && <span className="subTitle">{book.titleEnglish}</span>}
				</div>
				<div className="general">
					<div>
						{authors.length > 0 && (
							<p>
								Auteur.ic.es: <b>{authors.join(", ")}</b>
							</p>
						)}
						{artists.length > 0 && (
							<p>
								<i className="fa-solid fa-paintbrush"></i> Dessin: <b>{artists.join(", ")}</b>
							</p>
						)}
						{scenarists.length > 0 && (
							<p>
								<i className="fa-regular fa-file-lines"></i> Scenario: <b>{scenarists.join(", ")}</b>
							</p>
						)}
						<p>
							Type : <b>{book.type}</b>
							<br />
							Genres : <b>{(book.genres ?? []).join(", ")}</b>
						</p>
						{(book.links ?? []).length > 0 && (
							<p>
								Links:{" "}
								{book.links?.map((link) => (
									<Fragment key={link.url}>
										<a key={link.url} href={link.url} rel="noopener noreferrer">
											{link.name}
										</a>{" "}
									</Fragment>
								))}
							</p>
						)}
					</div>
				</div>
				<div className="stats"></div>
			</div>

			<h2>
				Lectures
				<label>
					<input type="checkbox" checked={groupReadings} onChange={changeGroupReadings} /> Grouper les
					lectures
				</label>
			</h2>
			<MutationError error={saveMutation.error} />
			<table className="list readings alternate responsive">
				<thead>
					<tr>
						<th></th>
						<th></th>
						<th>Date</th>
						<th>Nom</th>
						<th>Edition</th>
						<th>Langage</th>
						<th>Origine</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{readings.map((reading, index) => {
						const actionsDisabled = Boolean(groupReadings && reading.count && reading.count > 1);
						const classDisabled = actionsDisabled ? "disabled" : "";
						const lastReading = getReadingForQuickAdd(reading);
						return (
							<tr key={reading.id}>
								<td className="smalltext">#{index + 1}</td>
								<td data-label="Date">{formatDay(reading.date)}</td>
								<td data-label="Date">{formatDate(reading.date)}</td>
								<td>
									{getMangaPrefixName(reading)}
									{reading.name}
									{reading.title ? ` - ${reading.title}` : ""}
									{(reading.contextTags ?? []).map((c: string) => (
										<Badge
											key={c}
											icon="fa-solid fa-tag"
											name={c}
											color="white"
											backgroundColor="darkgrey"
										></Badge>
									))}
								</td>
								<td data-label="Edition">{reading.edition}</td>
								<td data-label="Langue">{reading.language}</td>
								<td data-label="Origine">{reading.origin}</td>
								<td data-label="Actions">
									<button
										type="button"
										onDoubleClick={() => quickAddReading(lastReading)}
										title="Ajouter le suivant"
									>
										<i className="fa-regular fa-circle-up"></i>
									</button>
									&nbsp;
									<button
										type="button"
										title="Modifier la lecture"
										onClick={() =>
											navigate({
												to: "/reading-manga/manga/$mangaId/reading/$readingId/edit",
												params: { mangaId, readingId: reading.id },
												search: { returnTo: location.pathname },
												replace: true,
												resetScroll: false,
												mask: {
													to: "/reading-manga/manga/$mangaId",
													params: { mangaId },
												},
											})
										}
										disabled={actionsDisabled}
									>
										<i className={`${classDisabled} fa-regular fa-pen-to-square`}></i>
									</button>
									&nbsp;
									<button
										type="button"
										title="Supprimer la lecture"
										disabled={actionsDisabled}
										onClick={() =>
											navigate({
												to: "/reading-manga/manga/$mangaId/reading/$readingId/delete",
												params: { mangaId, readingId: reading.id },
												search: { returnTo: location.pathname },
												replace: true,
												resetScroll: false,
												mask: {
													to: "/reading-manga/manga/$mangaId",
													params: { mangaId },
												},
											})
										}
									>
										<i className={`${classDisabled} fa-regular fa-trash-can`}></i>
									</button>
								</td>
							</tr>
						);
					})}
				</tbody>
				<tfoot></tfoot>
			</table>

			<div className="fab-container">
				<button
					type="button"
					className="fab-main"
					title="Ajouter une lecture"
					onClick={() =>
						navigate({
							to: "/reading-manga/manga/$mangaId/reading/add",
							params: { mangaId },
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
							mask: {
								to: "/reading-manga/manga/$mangaId",
								params: { mangaId },
							},
						})
					}
				>
					<div className="pulse"></div>
					<div className="heart-line">
						<i className="fa-solid fa-plus"></i>
					</div>
				</button>
			</div>

			<Outlet />
		</div>
	);
}
