import { formatPace } from "../chart-utils";
import { Sport } from "../types";

export function PaceSegmentChartTooltip({ active, payload, bands }: any) {
	if (!active || !payload?.length) return null;
	const d = payload[0].payload as Sport.ChartPoint;
	const band = (bands as Sport.Band[]).find((b) => d.distKm >= b.x1 && d.distKm <= b.x2);

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
			{band?.label && <div style={{ color: "#fff", fontWeight: "bold" }}>{band.label}</div>}
			{d.pace != null && <div style={{ color: "#4a9eff" }}>⏱ {formatPace(d.pace)}/km</div>}
		</div>
	);
}
