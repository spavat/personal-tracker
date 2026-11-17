import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import DisplaySelector from "../../../components/DisplaySelector";
import { useDisplay } from "../../../hooks/use-display";
import { authorsQuery } from "../api";
import { coverSrc } from "../utils";

// The people credited as author of a book, as cards or a list (same as the show artists)
export default function AuthorList() {
	const { data: authors } = useSuspenseQuery(authorsQuery());
	const [display, changeDisplay] = useDisplay("reading_book_author_list_display", "card");

	return (
		<>
			<h2>
				Auteur·ices
				<DisplaySelector value={display} onChange={changeDisplay} />
			</h2>
			{display === "list" ? (
				<table className="list authors alternate responsive">
					<thead>
						<tr>
							<th className="cell-index"></th>
							<th className="cell-text">Auteur·ice</th>
							<th className="cell-number">Livres</th>
							<th className="cell-number">Lectures</th>
						</tr>
					</thead>
					<tbody>
						{authors.map((author, i) => (
							<tr key={author.id}>
								<td className="cell-index">{i + 1}</td>
								<td className="cell-text">
									<Link to="/reading-book/authors/$authorId" params={{ authorId: author.id }}>
										{author.name}
									</Link>
								</td>
								<td className="cell-number" data-label="Livres">
									{author.nbBooks}
								</td>
								<td className="cell-number" data-label="Lectures">
									{author.nbReadings}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			) : (
				<div className="grid authors">
					{authors.map((author) => (
						<div key={author.id} className="card_item author">
							{author.picture ? (
								<img src={coverSrc(author.picture)} alt="" className="portrait-card" loading="lazy" />
							) : (
								<div className="portrait-card">
									<i className="fa-solid fa-user"></i>
								</div>
							)}
							<div>
								<span className="title">
									<Link to="/reading-book/authors/$authorId" params={{ authorId: author.id }}>
										{author.name}
									</Link>
								</span>
								<br />
								{author.nbBooks} livre{author.nbBooks > 1 ? "s" : ""} · {author.nbReadings} lecture
								{author.nbReadings > 1 ? "s" : ""}
							</div>
						</div>
					))}
				</div>
			)}
		</>
	);
}
