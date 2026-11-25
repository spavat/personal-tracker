import type { ReactNode } from "react";

import { useElementScrollRestoration } from "@tanstack/react-router";
import { defaultRangeExtractor, useWindowVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

// Only the rows on screen are rendered; spacer rows (in their own tbody) stand for the others.
// renderCells: the cells of an item's row (index: its position in the list).
export default function VirtualTable<T>({
	items,
	headers,
	className,
	getKey,
	renderCells,
}: {
	items: T[];
	headers: ReactNode[];
	className: string;
	getKey: (item: T) => string;
	renderCells: (item: T, index: number) => ReactNode;
}) {
	const tableRef = useRef<HTMLTableElement>(null);
	// scroll restored by the router on back/forward: start the rows there instead of at the top
	const scrollEntry = useElementScrollRestoration({ getElement: () => window });

	// The React Compiler would skip memoizing this component; harmless, the project doesn't use the compiler.
	// oxlint-disable-next-line react/incompatible-library
	const virtualizer = useWindowVirtualizer({
		count: items.length,
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
		<table ref={tableRef} className={className}>
			<thead>
				<tr>{headers.map((h) => h)}</tr>
			</thead>
			{paddingTop > 0 && spacer(paddingTop)}
			<tbody>
				{rows.map((row) => {
					const item = items[row.index];
					return (
						<tr key={getKey(item)} data-index={row.index} ref={virtualizer.measureElement}>
							{renderCells(item, row.index)}
						</tr>
					);
				})}
			</tbody>
			{paddingBottom > 0 && spacer(paddingBottom)}
		</table>
	);
}
