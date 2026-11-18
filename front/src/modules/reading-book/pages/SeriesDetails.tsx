import type { SeriesTreeItem } from "@personal-tracker/shared/reading-book";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { useIsOwner } from "../../../hooks/use-is-owner";
import { seriesDetailsQuery } from "../api";
import CardBook from "../components/CardBook";

// A series and its tree: books and sub-series, each level in its order, the books numbered in reading order
export default function SeriesDetails({ seriesId }: { seriesId: string }) {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();
	const { data: series } = useSuspenseQuery(seriesDetailsQuery(seriesId));

	function openModal(action: "edit" | "delete") {
		navigate({
			to: action === "edit" ? "/reading-book/series/$seriesId/edit" : "/reading-book/series/$seriesId/delete",
			params: { seriesId },
			search: { returnTo: location.pathname },
			replace: true,
			resetScroll: false,
			mask: { to: "/reading-book/series/$seriesId", params: { seriesId } },
		});
	}

	return (
		<div className="details">
			<h2>
				{series.title}
				{isOwner && (
					<>
						<button type="button" title="Modifier" onClick={() => openModal("edit")}>
							<i className="fa-regular fa-pen-to-square"></i>
						</button>
						<button type="button" title="Supprimer" onClick={() => openModal("delete")}>
							<i className="fa-regular fa-trash-can"></i>
						</button>
					</>
				)}
			</h2>
			{series.parents.length > 0 && (
				<p>
					Dans :{" "}
					{series.parents.map((parent, i) => (
						<span key={parent.id}>
							{i > 0 && ", "}
							<Link to="/reading-book/series/$seriesId" params={{ seriesId: parent.id }}>
								{parent.title}
							</Link>
						</span>
					))}
				</p>
			)}
			<p>
				{countBooks(series.items)} livre{countBooks(series.items) > 1 ? "s" : ""}
			</p>
			<SeriesLevel items={series.items} />

			<Outlet />
		</div>
	);
}

const countBooks = (items: SeriesTreeItem[]): number =>
	items.reduce((n, item) => n + (item.kind === "book" ? 1 : countBooks(item.items)), 0);

// One level: consecutive books in a grid, a sub-series as an indented section of its own
function SeriesLevel({ items }: { items: SeriesTreeItem[] }) {
	const blocks: Array<SeriesTreeItem[]> = [];
	for (const item of items) {
		const last = blocks.at(-1);
		if (item.kind === "book" && last?.[0].kind === "book") {
			last.push(item);
		} else {
			blocks.push([item]);
		}
	}
	return blocks.map((block) => {
		const first = block[0];
		if (first.kind === "series") {
			return (
				<section key={first.series.id} className="sub-series">
					<h3>
						{first.positionLabel && <span className="series-label">{first.positionLabel}</span>}
						<Link to="/reading-book/series/$seriesId" params={{ seriesId: first.series.id }}>
							{first.series.title}
						</Link>
					</h3>
					<SeriesLevel items={first.items} />
				</section>
			);
		}
		return (
			<div key={first.kind === "book" ? first.book.id : ""} className="grid">
				{block.map(
					(item) =>
						item.kind === "book" && (
							<CardBook
								key={item.book.id}
								book={item.book}
								label={item.positionLabel}
								readingOrder={item.readingOrder}
							/>
						),
				)}
			</div>
		);
	});
}
