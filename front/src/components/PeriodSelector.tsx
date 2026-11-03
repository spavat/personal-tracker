import { useHotkeys } from "react-hotkeys-hook";

export default function PeriodSelector({
	period,
	goPrevious,
	goNext,
	canGoPrevious,
	canGoNext,
	type,
}: {
	period: string;
	goPrevious: () => void;
	goNext: () => void;
	canGoPrevious: boolean;
	canGoNext: boolean;
	type: "month" | "year";
}) {
	const className = type === "year" ? "year-selector" : "month-year-selector";

	useHotkeys("ctrl+right", goNext);
	useHotkeys("ctrl+left", goPrevious);

	return (
		<div className={className}>
			<span>
				<button type="button" onClick={goPrevious} disabled={!canGoPrevious} aria-label="Go to previous">
					<i className="fa-solid fa-angle-left"></i>
				</button>
			</span>

			<h2 className="title">{period}</h2>
			<span>
				<button type="button" onClick={goNext} disabled={!canGoNext} aria-label="Go to next">
					<i className="fa-solid fa-angle-right"></i>
				</button>
			</span>
		</div>
	);
}
