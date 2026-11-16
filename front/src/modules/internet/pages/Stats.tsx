import { useCallback, useMemo, useOptimistic, useState, useTransition } from "react";

import { MusicGenres } from "../../../charts/MusicGenres";
import { HeaderPortal } from "../../../components/HeaderPortal";
import PeriodSelector from "../../../components/PeriodSelector";
import { useYearChanger } from "../../../hooks/use-year-changer";
import { getDurationString } from "../../../utils";
import { internetStats } from "../api";

const TOP_LIMIT = 20;

export default function Stats({ year }: { year: string }) {
	const [period, listQuery, goPrevious, goNext, canGoPrevious, canGoNext] = useYearChanger({
		...internetStats,
		navigationIsDisabled: (period: string, delta: "previous" | "next") => {
			if (delta === "next" && period >= String(Temporal.Now.plainDateISO().year)) {
				return true;
			} else if (delta === "previous" && period <= "2025") {
				return true;
			}
			return false;
		},
		initialPeriod: year,
	});

	const [selectedTag, setSelectedTag] = useState<string>("");
	const [showAllPrograms, setShowAllPrograms] = useState(false);
	const [showAllTags, setShowAllTags] = useState(false);
	// transition + optimistic: the checkbox toggles at once, the (slow) chart render follows
	const [, startTransition] = useTransition();
	const [optimisticShowAllPrograms, setOptimisticShowAllPrograms] = useOptimistic(showAllPrograms);
	const [optimisticShowAllTags, setOptimisticShowAllTags] = useOptimistic(showAllTags);

	function changeShowAllPrograms(e: React.ChangeEvent<HTMLInputElement>) {
		const checked = e.target.checked;
		startTransition(() => {
			setOptimisticShowAllPrograms(checked);
			setShowAllPrograms(checked);
		});
	}

	function changeShowAllTags(e: React.ChangeEvent<HTMLInputElement>) {
		const checked = e.target.checked;
		startTransition(() => {
			setOptimisticShowAllTags(checked);
			setShowAllTags(checked);
		});
	}

	const data = listQuery.data;
	// memoized: a new array reference makes recharts replay its animation (labels blink)
	const programs = useMemo(
		() => (showAllPrograms ? data.programs : data.programs.slice(0, TOP_LIMIT)),
		[data.programs, showAllPrograms],
	);
	const tags = useMemo(() => (showAllTags ? data.tags : data.tags.slice(0, TOP_LIMIT)), [data.tags, showAllTags]);
	const toggleSelectedTag = useCallback((val: string) => setSelectedTag((prev) => (val !== prev ? val : "")), []);
	const detailsTags = (data.tags ?? []).find((t) => t.name === selectedTag)?.details ?? [];

	return (
		<>
			<HeaderPortal>
				<PeriodSelector
					period={`Année ${period}`}
					goPrevious={goPrevious}
					goNext={goNext}
					canGoPrevious={canGoPrevious()}
					canGoNext={canGoNext()}
					type="year"
				/>
			</HeaderPortal>

			<div className="stats">
				<div className="headlines">
					<div className="metric">
						<span className="name">Moyenne par jour</span>
						<br />
						<span className="value">
							{getDurationString(data.summary.averageByDays)}
							{data.summary.inProgress && <>*</>}
						</span>
						<br />
						<span className="info">(sur {data.summary.nbDays} jours)</span>
					</div>

					<div className="metric">
						<span className="name">Total</span>
						<br />
						<span className="value">
							{getDurationString(data.summary.total)}
							{data.summary.inProgress && <>*</>}
						</span>
						<br />
						<span className="info">(sur {data.summary.nbDays} jours)</span>
					</div>

					<div className="metric">
						<span className="name">Programmes / Episodes</span>
						<br />
						<span className="value">
							{data.summary.nbPrograms}
							{data.summary.inProgress && <>*</>} / {data.summary.nbEpisodes}
							{data.summary.inProgress && <>*</>}
						</span>
						<br />
					</div>
				</div>

				<h3>
					Programmes{" "}
					<span>
						<label>
							<input
								type="checkbox"
								checked={optimisticShowAllPrograms}
								onChange={changeShowAllPrograms}
							/>{" "}
							Montrer tout
						</label>
					</span>
				</h3>
				<MusicGenres data={programs} />

				<h3>
					Tags {selectedTag && <>({selectedTag})</>}{" "}
					<span>
						<label>
							<input type="checkbox" checked={optimisticShowAllTags} onChange={changeShowAllTags} />{" "}
							Montrer tout
						</label>
					</span>
				</h3>
				<div className="stats-music-genre">
					<MusicGenres data={tags} setSelected={toggleSelectedTag} />
					{detailsTags.length > 0 && <MusicGenres data={detailsTags} reversed={true} />}
				</div>
			</div>
		</>
	);
}
