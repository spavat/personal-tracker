import type { ReactNode } from "react";

import { ArtistListResponse } from "@personal-tracker/shared/show";
import { Link, useElementScrollRestoration, useLocation, useNavigate } from "@tanstack/react-router";
import { defaultRangeExtractor, useWindowVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

// Only the rows on screen are rendered; spacer rows (in their own tbody) stand for the others.
export default function ArtistTable({
	artists,
	headers,
	isOwner,
}: {
	artists: ArtistListResponse[];
	headers: ReactNode[];
	isOwner: boolean;
}) {
	const navigate = useNavigate();
	const location = useLocation();
	const tableRef = useRef<HTMLTableElement>(null);
	// scroll restored by the router on back/forward: start the rows there instead of at the top
	const scrollEntry = useElementScrollRestoration({ getElement: () => window });

	// The React Compiler would skip memoizing this component; harmless, the project doesn't use the compiler.
	// oxlint-disable-next-line react/incompatible-library
	const virtualizer = useWindowVirtualizer({
		count: artists.length,
		estimateSize: () => 26, // real row height on desktop
		overscan: 10,
		scrollMargin: tableRef.current?.offsetTop ?? 0,
		initialOffset: scrollEntry?.scrollY,
		// start on an even row, so the .alternate stripes (tr:nth-child) don't swap while scrolling
		rangeExtractor: (range) => {
			const indexes = defaultRangeExtractor(range);
			return indexes[0] % 2 === 1 ? [indexes[0] - 1, ...indexes] : indexes;
		},
	});

	const rows = virtualizer.getVirtualItems();
	const { scrollMargin } = virtualizer.options;
	const paddingTop = rows.length ? rows[0].start - scrollMargin : 0;
	const paddingBottom = rows.length ? virtualizer.getTotalSize() - (rows[rows.length - 1].end - scrollMargin) : 0;

	const spacer = (height: number) => (
		<tbody aria-hidden="true">
			<tr style={{ height, padding: 0, border: "none" }}>
				<td colSpan={headers.length} style={{ padding: 0 }}></td>
			</tr>
		</tbody>
	);

	return (
		<table ref={tableRef} className="list artists alternate responsive">
			<thead>
				<tr>{headers.map((h) => h)}</tr>
			</thead>
			{paddingTop > 0 && spacer(paddingTop)}
			<tbody>
				{rows.map((row) => {
					const artist = artists[row.index];
					return (
						<tr key={artist.id} data-index={row.index} ref={virtualizer.measureElement}>
							<td className="smalltext">#{row.index + 1}</td>
							<td>
								<b>
									<Link to="/shows/artists/$artistId" params={{ artistId: String(artist.id) }}>
										{artist.name}
									</Link>
								</b>
							</td>
							<td data-label="Spectacles">{artist.nbSpectacles}</td>
							<td data-label="Représentations">{artist.nbPerformances}</td>
							{isOwner && (
								<td data-label="Actions">
									<button
										type="button"
										title="Modifier"
										onClick={() =>
											navigate({
												to: "/shows/artists/edit/$artistId",
												params: { artistId: String(artist.id) },
												search: { returnTo: location.pathname },
												replace: true,
												resetScroll: false,
												mask: {
													to: "/shows/artists",
												},
											})
										}
									>
										<i className="fa-regular fa-pen-to-square"></i>
									</button>
									&nbsp;
									<button
										type="button"
										title="Supprimer"
										onClick={() =>
											navigate({
												to: "/shows/artists/delete/$artistId",
												params: { artistId: String(artist.id) },
												search: { returnTo: location.pathname },
												replace: true,
												resetScroll: false,
												mask: {
													to: "/shows/artists",
												},
											})
										}
										disabled={artist.nbSpectacles > 0 || artist.nbPerformances > 0}
									>
										<i className="fa-regular fa-trash-can"></i>
									</button>
								</td>
							)}
						</tr>
					);
				})}
			</tbody>
			{paddingBottom > 0 && spacer(paddingBottom)}
		</table>
	);
}
