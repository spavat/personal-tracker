import { Segment, SportActivity, TrackPoint } from "@personal-tracker/shared/sport";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { updateSegments } from "../../api";
import { formatPace } from "../../chart-utils";
import PaceSegmentChart from "../../charts/PaceSegmentChart";
import { SELECT_TOLERANCE_KM, SEGMENT_LABELS } from "../../constants";
import { Sport } from "../../types";

// stable fallback: a new [] on every render would invalidate the memos below
const NO_SEGMENTS: Array<Segment> = [];

// Segments store timecodes (seconds elapsed since activity start); the chart is plotted
// against distance, so each segment boundary is mapped to the distance of the nearest chart
// point at or after that timecode.
function buildSegmentBands(segments: Array<Segment>, data: Array<Sport.ChartPoint>): Array<Sport.Band> {
	if (segments.length === 0 || data.length === 0) return [];

	const timed = data.filter((d) => d.elapsedSec != null);
	if (timed.length === 0) return [];

	const distAtElapsedSec = (sec: number): number => {
		const point = timed.find((d) => d.elapsedSec! >= sec);
		return point ? point.distKm : timed[timed.length - 1].distKm;
	};

	const sorted = [...segments].sort((a, b) => a.time - b.time);
	const lastDistKm = data[data.length - 1].distKm;
	const lastElapsedSec = timed[timed.length - 1].elapsedSec!;

	return sorted.map((segment, i) => {
		const nextTime = sorted[i + 1] ? sorted[i + 1].time : lastElapsedSec;
		return {
			time: segment.time,
			x1: distAtElapsedSec(segment.time),
			x2: sorted[i + 1] ? distAtElapsedSec(sorted[i + 1].time) : lastDistKm,
			type: segment.type,
			durationSec: Math.max(0, nextTime - segment.time),
			label: segment.label,
		};
	});
}

// When there are no stored segments — typically a continuous run with no pause worth
// recording — synthesize a single "whole run" row for the pace summary table only. Nothing is
// persisted and the interactive chart (backgrounds, click-to-select) is unaffected.
function buildWholeRunBand(data: Array<Sport.ChartPoint>): Sport.Band | null {
	const timed = data.filter((d) => d.elapsedSec != null);
	if (timed.length === 0) return null;

	const first = timed[0];
	const last = timed[timed.length - 1];

	return {
		time: 0,
		x1: first.distKm,
		x2: last.distKm,
		type: "running",
		durationSec: Math.max(0, last.elapsedSec! - first.elapsedSec!),
		label: "Course complète",
	};
}

function formatElapsed(sec: number): string {
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = Math.round(sec % 60);
	if (h > 0) {
		return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	}
	return `${m}:${String(s).padStart(2, "0")}`;
}

function parseElapsedInput(input: string): number | null {
	const trimmed = input.trim();
	if (/^\d+$/.test(trimmed)) return Number(trimmed);
	const match = trimmed.match(/^(\d+):([0-5]?\d)$/);
	if (!match) return null;
	return Number(match[1]) * 60 + Number(match[2]);
}

function SegmentsPaceTable({
	bands,
	onHoverRow,
}: {
	bands: Array<Sport.Band>;
	onHoverRow: (range: Sport.HighlightRange | null) => void;
}) {
	return (
		<table className="list alternate">
			<thead>
				<tr>
					<th>Libellé</th>
					<th>Distance</th>
					<th>Durée</th>
					<th>Allure</th>
				</tr>
			</thead>
			<tbody>
				{bands.length === 0 && (
					<tr>
						<td colSpan={4}>Aucun segment.</td>
					</tr>
				)}
				{bands.map((band) => {
					const rowProps = {
						onMouseEnter: () => onHoverRow({ x1: band.x1, x2: band.x2 }),
						onMouseLeave: () => onHoverRow(null),
					};

					if (band.type === "pause") {
						return (
							<tr key={band.time} {...rowProps}>
								<td colSpan={4}>
									Pause{band.label ? ` (${band.label})` : ""} – {formatElapsed(band.durationSec)}
								</td>
							</tr>
						);
					}

					const distanceKm = band.x2 - band.x1;
					const paceSecPerKm = distanceKm > 0 ? band.durationSec / distanceKm : null;

					return (
						<tr key={band.time} {...rowProps}>
							<td>{band.label ?? "–"}</td>
							<td>{distanceKm.toFixed(2)} km</td>
							<td>{formatElapsed(band.durationSec)}</td>
							<td>{paceSecPerKm != null ? `${formatPace(paceSecPerKm)}/km` : "–"}</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}

export default function SegmentsEditor({
	activity,
	chartData,
	updateMarker,
	highlightRange,
	onHighlightRange,
}: {
	activity: SportActivity;
	chartData: Array<Sport.ChartPoint>;
	updateMarker: React.RefObject<(p: TrackPoint | null) => void>;
	highlightRange: Sport.HighlightRange | null;
	onHighlightRange: (range: Sport.HighlightRange | null) => void;
}) {
	const queryClient = useQueryClient();

	const [pending, setPending] = useState<{ elapsedSec: number; distKm: number } | null>(null);
	const [selectedTime, setSelectedTime] = useState<number | null>(null);
	const [newTimeInput, setNewTimeInput] = useState("");
	const [newType, setNewType] = useState<Segment["type"]>("pause");
	const [newLabel, setNewLabel] = useState("");
	const [formError, setFormError] = useState("");

	const segments = activity.segments ?? NO_SEGMENTS;
	const bands = useMemo(() => buildSegmentBands(segments, chartData), [segments, chartData]);
	const paceTableBands = useMemo(() => {
		if (bands.length > 0) return bands;
		const wholeRun = buildWholeRunBand(chartData);
		return wholeRun ? [wholeRun] : [];
	}, [bands, chartData]);

	const mutation = useMutation({
		mutationFn: updateSegments,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sport", "activity", activity.id] });
			setPending(null);
			setSelectedTime(null);
			setNewTimeInput("");
			setNewLabel("");
			setFormError("");
		},
	});

	function saveSegments(next: Array<Segment>) {
		mutation.mutate({ id: activity.id, segments: next });
	}

	function addSegment(time: number, type: Segment["type"], label?: string) {
		if (segments.some((s) => s.time === time)) {
			setFormError("Un segment existe déjà à ce timecode");
			return;
		}
		saveSegments([...segments, { time, type, ...(label ? { label } : {}) }]);
	}

	function deleteSegment(time: number) {
		saveSegments(segments.filter((s) => s.time !== time));
	}

	function updateLabel(time: number, newLabel: string) {
		const trimmed = newLabel.trim();
		const current = segments.find((s) => s.time === time);
		if (!current || (current.label ?? "") === trimmed) return;

		saveSegments(
			segments.map((s) => {
				if (s.time !== time) return s;
				const { label: _oldLabel, ...rest } = s;
				return trimmed ? { ...rest, label: trimmed } : rest;
			}),
		);
	}

	function handleChartClick(point: Sport.ChartPoint) {
		if (point.elapsedSec == null) return;

		const nearBand = bands.find((b) => Math.abs(b.x1 - point.distKm) <= SELECT_TOLERANCE_KM);
		if (nearBand) {
			setSelectedTime(nearBand.time);
			setPending(null);
		} else {
			setSelectedTime(null);
			setPending({ elapsedSec: Math.round(point.elapsedSec), distKm: point.distKm });
		}
	}

	function onAddFormSubmit(e: React.FormEvent) {
		e.preventDefault();
		const time = parseElapsedInput(newTimeInput);
		if (time == null) {
			setFormError("Format attendu : mm:ss ou secondes");
			return;
		}
		setFormError("");
		addSegment(time, newType, newLabel.trim() || undefined);
	}

	return (
		<div>
			<h3>Segments</h3>

			{chartData.some((d) => d.pace != null) && (
				<PaceSegmentChart
					data={chartData}
					bands={bands}
					selectedTime={selectedTime}
					pendingDistKm={pending?.distKm ?? null}
					highlightRange={highlightRange}
					onHover={(p) => updateMarker.current(p)}
					onLeave={() => updateMarker.current(null)}
					onChartClick={handleChartClick}
				/>
			)}

			{pending && (
				<p>
					Ajouter un segment à {formatElapsed(pending.elapsedSec)} :&nbsp;
					<button
						type="button"
						onClick={() => addSegment(pending.elapsedSec, "running")}
						disabled={mutation.isPending}
					>
						▶ Course
					</button>
					&nbsp;
					<button
						type="button"
						onClick={() => addSegment(pending.elapsedSec, "pause")}
						disabled={mutation.isPending}
					>
						⏸ Pause / marche
					</button>
					&nbsp;
					<button type="button" onClick={() => setPending(null)}>
						Annuler
					</button>
				</p>
			)}

			{selectedTime != null && (
				<p>
					Segment à {formatElapsed(selectedTime)} :&nbsp;
					<button type="button" onClick={() => deleteSegment(selectedTime)} disabled={mutation.isPending}>
						<i className="fa-regular fa-trash-can"></i> Supprimer
					</button>
					&nbsp;
					<button type="button" onClick={() => setSelectedTime(null)}>
						Annuler
					</button>
				</p>
			)}

			<div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
				<div style={{ flex: "1 1 280px" }}>
					<SegmentsPaceTable bands={paceTableBands} onHoverRow={onHighlightRange} />
				</div>

				<div style={{ flex: "1 1 280px" }}>
					<table className="list alternate">
						<thead>
							<tr>
								<th>Temps</th>
								<th>Distance</th>
								<th>Type</th>
								<th>Libellé</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{segments.length === 0 && (
								<tr>
									<td colSpan={5}>Aucun segment.</td>
								</tr>
							)}
							{segments.map((s) => {
								const band = bands.find((b) => b.time === s.time);
								return (
									<tr
										key={s.time}
										style={s.time === selectedTime ? { fontWeight: "bold" } : undefined}
									>
										<td className="monospace">{formatElapsed(s.time)}</td>
										<td className="monospace">{band ? `${band.x1.toFixed(2)} km` : "–"}</td>
										<td>{SEGMENT_LABELS[s.type]}</td>
										<td>
											<input
												type="text"
												defaultValue={s.label ?? ""}
												placeholder="–"
												onBlur={(e) => updateLabel(s.time, e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter") e.currentTarget.blur();
												}}
												disabled={mutation.isPending}
												style={{ width: "100%" }}
											/>
										</td>
										<td>
											<button
												type="button"
												onClick={() => deleteSegment(s.time)}
												disabled={mutation.isPending}
												title="Supprimer"
											>
												<i className="fa-regular fa-trash-can"></i>
											</button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>

					<form onSubmit={onAddFormSubmit}>
						<input
							type="text"
							placeholder="mm:ss"
							value={newTimeInput}
							onChange={(e) => setNewTimeInput(e.target.value)}
							style={{ width: 70 }}
						/>
						&nbsp;
						<select
							value={newType}
							onChange={(e) => setNewType(e.target.value as Segment["type"])}
							aria-label="Type"
						>
							<option value="running">Course</option>
							<option value="pause">Pause / marche</option>
						</select>
						&nbsp;
						<input
							type="text"
							placeholder="Libellé (optionnel)"
							value={newLabel}
							onChange={(e) => setNewLabel(e.target.value)}
							style={{ width: 140 }}
						/>
						&nbsp;
						<button type="submit" disabled={mutation.isPending}>
							Ajouter
						</button>
						{formError && <span style={{ color: "#f44336", marginLeft: 8 }}>{formError}</span>}
					</form>
				</div>
			</div>
		</div>
	);
}
