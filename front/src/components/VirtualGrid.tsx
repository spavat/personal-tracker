import type { ReactNode } from "react";

import { useElementScrollRestoration } from "@tanstack/react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";

// Reads how many columns the CSS grid actually created, and updates on resize.
function useGridColumns(ref: RefObject<HTMLElement | null>) {
	const [columns, setColumns] = useState(1);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const update = () => setColumns(getComputedStyle(el).gridTemplateColumns.split(" ").length);
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, [ref]);
	return columns;
}

// Only the rows on screen are rendered; the column count comes from the CSS of the `className` grid.
// rowHeight: the real row height (card + gap), so rows land where they were before leaving.
// renderItem: a card, with its key.
export default function VirtualGrid<T>({
	items,
	className,
	rowHeight,
	renderItem,
}: {
	items: T[];
	className: string;
	rowHeight: number;
	renderItem: (item: T) => ReactNode;
}) {
	const listRef = useRef<HTMLDivElement>(null);
	const probeRef = useRef<HTMLDivElement>(null);
	const columns = useGridColumns(probeRef);
	const rowCount = Math.ceil(items.length / columns);
	// scroll restored by the router on back/forward: start the rows there, so the right cards are rendered
	// when the portrait view transition takes its snapshot
	const scrollEntry = useElementScrollRestoration({ getElement: () => window });

	// The React Compiler would skip memoizing this component; harmless, the project doesn't use the compiler.
	// oxlint-disable-next-line react/incompatible-library
	const virtualizer = useWindowVirtualizer({
		count: rowCount,
		estimateSize: () => rowHeight,
		overscan: 3,
		scrollMargin: listRef.current?.offsetTop ?? 0,
		initialOffset: scrollEntry?.scrollY,
	});

	return (
		<div ref={listRef} style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
			{/* empty grid with the same CSS, used only to count the columns */}
			<div ref={probeRef} className={className} style={{ height: 0 }} aria-hidden="true" />

			{virtualizer.getVirtualItems().map((row) => (
				<div
					key={row.key}
					data-index={row.index}
					ref={virtualizer.measureElement}
					className={className}
					style={{
						position: "absolute",
						top: 0,
						width: "100%",
						transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
						paddingBottom: "1rem",
					}}
				>
					{items.slice(row.index * columns, (row.index + 1) * columns).map(renderItem)}
				</div>
			))}
		</div>
	);
}
