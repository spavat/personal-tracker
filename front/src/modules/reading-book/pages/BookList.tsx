import { creditName } from "@personal-tracker/shared/reading-book";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { PendingContent } from "../../../components/PendingContent";
import { useIsOwner } from "../../../hooks/use-is-owner";
import { useSortTable } from "../../../hooks/use-sort-table";
import { formatDate, languageName } from "../../../utils";
import { bookListSort } from "../api";
import SeriesPath from "../components/SeriesPath";

export default function BookList() {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();
	const { query, headers, isPending } = useSortTable({
		...bookListSort,
		columnsList: [
			{ name: "", isSortable: false, className: "cell-index" },
			{ name: "Livre", colName: "book", isSortable: true, className: "cell-text" },
			{ name: "Auteur", colName: "author", isSortable: true, className: "cell-text" },
			{ name: "Langue", colName: "language", isSortable: true, className: "cell-text" },
			{ name: "Pays", colName: "country", isSortable: true, className: "cell-icon" },
			{ name: "Lecture", colName: "nbReadings", isSortable: true, className: "cell-number" },
			{ name: "Début", colName: "firstReadDate", isSortable: true, className: "cell-date" },
			{ name: "Fin", colName: "lastReadDate", isSortable: true, className: "cell-date" },
			{ name: "Pages", colName: "pages", isSortable: true, className: "cell-number" },
			...(isOwner ? [{ name: "Actions", colName: "", isSortable: false }] : []),
		],
	});

	return (
		<>
			<PendingContent isPending={isPending}>
				<table className="list books alternate responsive">
					<thead>
						<tr>{headers.map((h) => h)}</tr>
					</thead>
					<tbody>
						{query.data.map((book, i) => {
							return (
								<tr key={book.id}>
									<td className="cell-index">{i + 1}</td>
									<td className="cell-text">
										<Link to="/reading-book/book/$bookId" params={{ bookId: book.id }}>
											{book.book}
										</Link>
										{book.series.map((series) => (
											<div key={series.id} className="smalltext">
												<SeriesPath series={series} />
											</div>
										))}
									</td>
									<td className="cell-text" data-label="Auteur">
										{book.authors.map((author, i) => (
											<span key={author.entityId}>
												{i > 0 && ", "}
												<Link to="/entities/$entityId" params={{ entityId: author.entityId }}>
													{creditName(author)}
												</Link>
											</span>
										))}
									</td>
									<td className="cell-text" data-label="Langue">
										{book.language && languageName(book.language)}
									</td>
									<td className="cell-icon" data-label="Pays">
										<span className={`fi fi-${book.country}`}></span>
									</td>
									<td className="cell-number" data-label="Lectures">
										{book.nbReadings}
									</td>
									<td className="cell-date" data-label="Début">
										{formatDate(book.firstReadDate)}
									</td>
									<td className="cell-date" data-label="Fin">
										{formatDate(book.lastReadDate)}
									</td>
									<td className="cell-number" data-label="Pages">
										{book.pages !== null && `${book.pages} pages`}
									</td>
									{isOwner && (
										<td data-label="Actions">
											<button
												type="button"
												title="Modifier"
												onClick={() =>
													navigate({
														to: "/reading-book/list/$bookId/edit",
														params: { bookId: book.id },
														search: { returnTo: location.pathname },
														replace: true,
														resetScroll: false,
														mask: { to: "/reading-book/list" },
													})
												}
											>
												<i className="fa-regular fa-pen-to-square"></i>
											</button>
										</td>
									)}
								</tr>
							);
						})}
					</tbody>
					<tfoot>
						<tr>
							<td colSpan={11}></td>
						</tr>
					</tfoot>
				</table>
			</PendingContent>
			{isOwner && (
				<div className="fab-container">
					<button
						type="button"
						className="fab-main"
						title="Ajouter un livre"
						onClick={() =>
							navigate({
								to: "/reading-book/list/add",
								search: { returnTo: location.pathname },
								replace: true,
								resetScroll: false,
								mask: {
									to: "/reading-book/list",
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
			)}
			<Outlet />
		</>
	);
}
