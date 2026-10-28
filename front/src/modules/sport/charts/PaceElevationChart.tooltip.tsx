import { formatPace } from "../chart-utils";
import { Sport } from "../types";

export default function PaceElevationChartTooltip({ active, payload }: any) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload as Sport.ChartPoint;
	return (
		<div
			style={{
				background: "#1e1e1e",
				border: "1px solid #444",
				padding: "6px 10px",
				borderRadius: 4,
				fontSize: "0.82em",
			}}
		>
			<div style={{ color: "#aaa" }}>{d.distKm.toFixed(2)} km</div>
			{d.pace != null && <div style={{ color: "#4a9eff" }}>⏱ {formatPace(d.pace)}/km</div>}
			{d.ele != null && <div style={{ color: "#999" }}>⛰ {d.ele.toFixed(0)} m</div>}
		</div>
	);
}
