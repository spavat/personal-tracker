import { TrackPoint } from "@personal-tracker/shared/sport";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

import { formatFullDate, getDurationString } from "../../../../utils";
import { activityDetailsQuery, getActivityDownloadUrl } from "../../api";
import { formatPace } from "../../chart-utils";
import PaceElevationChart from "../../charts/PaceElevationChart";
import TrackMap from "../../maps/TrackMap";
import { Sport } from "../../types";
import { computeKmSplits, formatPaceMinPerKm, getActivityTypeLabel, KmSplit } from "../../utils";
import SegmentsEditor from "./SegmentsEditor";

// ─── km splits ──────────────────────────────────────────────────────────────

function KmSplitsTable({
	splits,
	onHoverRow,
}: {
	splits: KmSplit[];
	onHoverRow: (range: Sport.HighlightRange | null) => void;
}) {
	return (
		<table className="list alternate">
			<thead>
				<tr>
					<th>Km</th>
					<th>Allure</th>
				</tr>
			</thead>
			<tbody>
				{splits.map((s) => {
					const x1 = s.km - 1;
					const x2 = x1 + s.distanceKm;
					return (
						<tr
							key={s.km}
							onMouseEnter={() => onHoverRow({ x1, x2 })}
							onMouseLeave={() => onHoverRow(null)}
						>
							<td>{s.distanceKm < 1 ? `${s.km} (${Math.round(s.distanceKm * 1000)} m)` : s.km}</td>
							<td>{formatPace(s.paceSecPerKm)}/km</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function ActivityDetails({ activityId }: { activityId: string }) {
	const navigate = useNavigate();
	const location = useLocation();

	// Shared ref: chart hover calls this directly → no React re-renders on hover
	const updateMarker = useRef<(p: TrackPoint | null) => void>(() => {});

	// Row hover (km splits, and later segments) is low-frequency, so plain state is fine here
	const [hoverRange, setHoverRange] = useState<Sport.HighlightRange | null>(null);

	const { data: activity } = useSuspenseQuery(activityDetailsQuery(activityId));

	// Stable derived data — useMemo so recharts never sees a new array reference
	const points = useMemo<TrackPoint[]>(() => activity.points ?? [], [activity]);

	const kmSplits = useMemo(() => computeKmSplits(points), [points]);

	const chartData = useMemo<Sport.ChartPoint[]>(() => {
		const startTime = points.find((p) => p.time)?.time;
		const startMs = startTime ? new Date(startTime).getTime() : null;

		return points
			.filter((p) => !p.isSuspect)
			.map((p) => ({
				id: p.id,
				distKm: (p.distanceFromStart ?? 0) / 1000,
				elapsedSec: startMs != null && p.time ? (new Date(p.time).getTime() - startMs) / 1000 : null,
				ele: p.ele ?? null,
				pace: p.pace ?? null,
				__point: p, // piggyback the full point so onMouseMove can call updateMarker directly
			}));
	}, [points]);

	return (
		<>
			<div className="presentation">
				<div className="title">
					<h2>
						{activity.name}&ensp;
						{activity.gpxKey && (
							<button
								type="button"
								title="Télécharger le fichier GPX"
								onClick={() => {
									window.location.href = getActivityDownloadUrl(activity.id);
								}}
							>
								<i className="fa-solid fa-download"></i>
							</button>
						)}
						&nbsp;
						<button
							type="button"
							title="Modifier"
							onClick={() =>
								navigate({
									to: "/sport/$activityId/edit",
									params: { activityId: activity.id },
									search: { returnTo: location.pathname },
									replace: true,
									resetScroll: false,
									mask: { to: "/sport/$activityId", params: { activityId: activity.id } },
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
									to: "/sport/$activityId/delete",
									params: { activityId: activity.id },
									search: { returnTo: location.pathname },
									replace: true,
									resetScroll: false,
									mask: { to: "/sport/$activityId", params: { activityId: activity.id } },
								})
							}
						>
							<i className="fa-regular fa-trash-can"></i>
						</button>
						{points.length > 1 && (
							<>
								&nbsp;
								<button
									type="button"
									title="Rogner le tracé"
									onClick={() =>
										navigate({ to: "/sport/$activityId/crop", params: { activityId: activity.id } })
									}
								>
									<i className="fa-solid fa-crop-simple"></i>
								</button>
							</>
						)}
					</h2>
				</div>
				<div className="general">
					<p>
						<strong>Type :</strong> {getActivityTypeLabel(activity.type)}
						<br />
						<strong>Date :</strong> {formatFullDate(activity.date)}
						<br />
						<strong>Distance :</strong> {activity.details.distance} km
						<br />
						<strong>Temps :</strong> {getDurationString(activity.details.totalDuration)} (en mouvement{" "}
						{getDurationString(activity.details.movingDuration)})
						<br />
						<strong>Allure :</strong> {formatPaceMinPerKm(activity.details.pace)} /km
						{(activity.details.elevationGain != null || activity.details.elevationLoss != null) && (
							<>
								<br />
								<strong>Dénivelé positif :</strong> {activity.details.elevationGain ?? 0} m<br />
								<strong>Dénivelé négatif :</strong> {activity.details.elevationLoss ?? 0} m
								<br />
								<strong>Dénivelé :</strong>{" "}
								{(activity.details.elevationGain ?? 0) - (activity.details.elevationLoss ?? 0)} m
							</>
						)}
					</p>
					{activity.comment && <p>{activity.comment}</p>}
				</div>
			</div>

			{points.length > 0 && (
				<>
					<div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
						{kmSplits.length > 0 && (
							<div style={{ flex: "0 0 260px", maxHeight: 420, overflowY: "auto" }}>
								<KmSplitsTable splits={kmSplits} onHoverRow={setHoverRange} />
							</div>
						)}
						<div style={{ flex: "1 1 320px" }}>
							<TrackMap points={points} updateRef={updateMarker} highlightRange={hoverRange} />
						</div>
					</div>
					{chartData.some((d) => d.pace != null) && (
						<PaceElevationChart
							data={chartData}
							highlightRange={hoverRange}
							onHover={(p) => updateMarker.current(p)}
							onLeave={() => updateMarker.current(null)}
						/>
					)}
					<SegmentsEditor
						activity={activity}
						chartData={chartData}
						updateMarker={updateMarker}
						highlightRange={hoverRange}
						onHighlightRange={setHoverRange}
					/>
				</>
			)}

			<Outlet />
		</>
	);
}
