import { TrackPoint } from "@personal-tracker/shared/sport";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { activityDetailsQuery, cropActivity } from "../../api";
import TrackMap from "../../maps/TrackMap";

export default function CropTrace({ activityId }: { activityId: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: activity } = useSuspenseQuery(activityDetailsQuery(activityId));
	const points = activity.points ?? [];
	const updateMarker = useRef<(p: TrackPoint | null) => void>(() => {});

	// User-picked range, once they've touched a slider — until then, defaults to the full track
	const [userRange, setUserRange] = useState<{ start: number; end: number } | null>(null);
	const range = userRange ?? (points.length > 0 ? { start: 0, end: points.length - 1 } : null);

	const cropMutation = useMutation({
		mutationFn: cropActivity,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sport", "activity", activityId] });
			queryClient.invalidateQueries({ queryKey: ["sport", "activities"] });
			goToDetails();
		},
	});

	function goToDetails() {
		navigate({ to: "/sport/$activityId", params: { activityId }, replace: true, resetScroll: false });
	}

	function handleSave() {
		if (!range) return;
		cropMutation.mutate({ id: activityId, startIndex: range.start, endIndex: range.end });
	}

	if (!range) return <p>Chargement&hellip;</p>;

	const highlightRange = {
		x1: (points[range.start].distanceFromStart ?? 0) / 1000,
		x2: (points[range.end].distanceFromStart ?? 0) / 1000,
	};

	return (
		<div
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					handleSave();
				}
			}}
		>
			<h2>Rogner le tracé — {activity.name}</h2>
			<p>Ajustez le début et la fin, puis appuyez sur Entrée pour enregistrer.</p>

			<TrackMap points={points} updateRef={updateMarker} highlightRange={highlightRange} />

			<label style={{ display: "block", marginTop: 16 }}>
				Début : point {range.start + 1} / {points.length}
				<input
					type="range"
					min={0}
					max={points.length - 1}
					value={range.start}
					onChange={(e) =>
						setUserRange({ start: Math.min(Number(e.target.value), range.end - 1), end: range.end })
					}
					style={{ width: "100%" }}
				/>
			</label>
			<label style={{ display: "block", marginTop: 8 }}>
				Fin : point {range.end + 1} / {points.length}
				<input
					type="range"
					min={0}
					max={points.length - 1}
					value={range.end}
					onChange={(e) =>
						setUserRange({ start: range.start, end: Math.max(Number(e.target.value), range.start + 1) })
					}
					style={{ width: "100%" }}
				/>
			</label>

			<div className="dialog-footer">
				<button type="button" onClick={goToDetails}>
					Annuler
				</button>
				<button type="button" className="main" onClick={handleSave} disabled={cropMutation.isPending}>
					Enregistrer
				</button>
			</div>
		</div>
	);
}
