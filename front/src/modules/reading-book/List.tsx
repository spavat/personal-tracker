import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { PendingContent } from "../../components/pending-content";
import { useSortTable } from "../../hooks/use-sort-table";
import { formatDate } from "../../utils";
import { bookListSort } from "./api";

export default function List() {
	const navigate = useNavigate();
	const location = useLocation();
	const { query, headers, isPending } = useSortTable({
		...bookListSort,
		columnsList: [
			null,
			{ name: "Livre", colName: "book", isSortable: true },
			{ name: "Auteur", colName: "author", isSortable: true },
			{ name: "Langue", colName: "language", isSortable: true },
			{ name: "Pays", colName: "country", isSortable: true },
			{ name: "Lecture", colName: "nbReadings", isSortable: true },
			{ name: "Début", colName: "firstReadDate", isSortable: true },
			{ name: "Fin", colName: "lastReadDate", isSortable: true },
			{ name: "Pages", colName: "pages", isSortable: true },
			{ name: "Actions", colName: "", isSortable: false },
		],
	});

	return (
		<>
			<PendingContent isPending={isPending}>
				<table className="list books alternate">
					<thead>
						<tr>{headers.map((h) => h)}</tr>
					</thead>
					<tbody>
						{query.data.map((book, i) => {
							return (
								<tr key={book.id}>
									<td className="smalltext">#{i + 1}</td>
									<td>
										<Link to="/reading-book/book/$bookId" params={{ bookId: book.id }}>
											{book.book}
										</Link>
									</td>
									<td>{book.author}</td>
									<td>{book.language}</td>
									<td>
										<span className={`fi fi-${book.country}`}></span>
									</td>
									<td>{book.nbReadings}</td>
									<td>{formatDate(book.firstReadDate)}</td>
									<td>{formatDate(book.lastReadDate)}</td>
									<td>{book.pages !== null && `${book.pages} pages`}</td>
									<td>
										{/* <button key="edit" type="button" onClick={() => showPlayModal(game.id)}>
									<i className="fa-regular fa-pen-to-square"></i>
								</button> */}
									</td>
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
			<Outlet />
		</>
	);
}
