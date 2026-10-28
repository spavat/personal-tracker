import { Outlet } from "@tanstack/react-router";
import { useState } from "react";

import { MusicGenres } from "../../charts/music-genre";
import { MusicReleaseYear } from "../../charts/music-release-year";
import { MusicYear } from "../../charts/music-year";
import { HeaderPortal } from "../../components/HeaderPortal";
import PeriodSelector from "../../components/period-selector";
import { useYearChanger } from "../../hooks/use-year-changer";
import { formatMonth, getDurationString } from "../../utils";
import { musicStats } from "./api";

export default function Stats({ year }: { year: string }) {
	const [period, statsQuery, goPrevious, goNext, canGoPrevious, canGoNext] = useYearChanger({
		...musicStats,
		navigationIsDisabled: (period: string, delta: "previous" | "next") => {
			if (delta === "next" && period >= String(Temporal.Now.plainDateISO().year)) {
				return true;
			} else if (delta === "previous" && period <= "2024") {
				return true;
			}
			return false;
		},
		initialPeriod: year,
	});

	const [selectedGenre, setSelectedGenre] = useState<string>("");

	const genreDetails = statsQuery.data.genresDistribution.find((item: any) => item.name === selectedGenre);

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
							{/* under a minute per day: shown as 0, not left empty */}
							{getDurationString(statsQuery.data.averageDurationPerDay) || "0min"}
							{statsQuery.data.inProgress && <>*</>}
						</span>
						<br />
						<span className="info">(sur {statsQuery.data.nbDays} jours)</span>
					</div>

					<div className="metric">
						<span className="name">Total</span>
						<br />
						<span className="value">
							{getDurationString(statsQuery.data.totalDuration)}
							{statsQuery.data.inProgress && <>*</>}
						</span>
						<br />
						<span className="info">(sur {statsQuery.data.nbDays} jours)</span>
					</div>

					<div className="metric">
						<span className="name">Albums / EPs</span>
						<br />
						<span className="value">
							{statsQuery.data.nbListenings}
							{statsQuery.data.inProgress && <>*</>}
						</span>
						<br />
					</div>
				</div>

				<h3>Répartition par mois</h3>
				<MusicYear
					data={statsQuery.data.monthsDistribution.map((m) => ({ ...m, name: formatMonth(`${m.name}-01`) }))}
				/>
				<h3>Répartition par genres {selectedGenre ? `: (${selectedGenre})` : ""}</h3>
				<div className="stats-music-genre">
					<MusicGenres
						data={statsQuery.data.genresDistribution}
						reversed={false}
						setSelected={(val: string) => {
							if (val === selectedGenre) {
								setSelectedGenre("");
							} else {
								setSelectedGenre(val);
							}
						}}
					/>

					{selectedGenre && genreDetails && <MusicGenres data={genreDetails.details} reversed={true} />}
				</div>
				<h3>Répartition par années</h3>
				<MusicReleaseYear data={statsQuery.data.releaseYearsDistribution} />
			</div>
			<Outlet />
		</>
	);
}
