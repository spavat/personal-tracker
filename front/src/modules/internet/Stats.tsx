import { useState } from "react";

import { MusicGenres } from "../../charts/music-genre";
import { HeaderPortal } from "../../components/HeaderPortal";
import PeriodSelector from "../../components/period-selector";
import { useYearChanger } from "../../hooks/use-year-changer";
import { getDurationString } from "../../utils";
import { internetStats } from "./api";

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

	const data = listQuery.data;
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

				<h3>Programmes</h3>
				<MusicGenres data={data.programs} />

				<h3>Tags {selectedTag && <>({selectedTag})</>}</h3>
				<div className="stats-music-genre">
					<MusicGenres
						data={data.tags}
						setSelected={(val: string) => {
							if (val !== selectedTag) {
								setSelectedTag(val);
							} else {
								setSelectedTag("");
							}
						}}
					/>
					{detailsTags.length > 0 && <MusicGenres data={detailsTags} reversed={true} />}
				</div>
			</div>
		</>
	);
}
