import { useState, useTransition } from "react";

import { HeaderPortal } from "../components/HeaderPortal";
import PageTitle from "../components/page-title";
import { PendingContent } from "../components/pending-content";
import PeriodSelector from "../components/period-selector";
import { WidgetBoundary } from "../components/widget-boundary";
import MiniMusicalReport from "./MiniMusicalReport";
import MiniMusicReport from "./MiniMusicReport";
import MiniReadingReport from "./MiniReadingReport";

export default function MainReports() {
	const [year, setYear] = useState<string>(String(Temporal.Now.plainDateISO().year));
	const [isPending, startTransition] = useTransition();

	function changeYear(mode: "previous" | "next") {
		if (mode === "previous") {
			return parseInt(year, 10) - 1;
		}
		return parseInt(year, 10) + 1;
	}

	return (
		<>
			<PageTitle title="Bilan" />
			<HeaderPortal>
				<PeriodSelector
					period={`Année ${year}`}
					goPrevious={() => startTransition(() => setYear(String(changeYear("previous"))))}
					goNext={() => startTransition(() => setYear(String(changeYear("next"))))}
					canGoPrevious={true}
					canGoNext={true}
					type="year"
				/>
			</HeaderPortal>

			{/* transition: keep the previous year displayed (dimmed) while the new one loads */}
			<PendingContent isPending={isPending}>
				<div className="stats">
					<h2>Musique</h2>
					<WidgetBoundary>
						<MiniMusicReport year={year} />
					</WidgetBoundary>

					<h2>Lecture / Livres</h2>
					<WidgetBoundary>
						<MiniReadingReport year={year} />
					</WidgetBoundary>

					<h2>Spectacles</h2>
					<WidgetBoundary>
						<MiniMusicalReport year={year} />
					</WidgetBoundary>
				</div>
			</PendingContent>
		</>
	);
}
