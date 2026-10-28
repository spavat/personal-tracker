import { TrackPoint } from "@personal-tracker/shared/sport";
import {
	ResponsiveContainer,
	ComposedChart,
	CartesianGrid,
	XAxis,
	YAxis,
	Tooltip,
	ReferenceArea,
	ReferenceLine,
	Line,
} from "recharts";

import { buildKmTicks, formatPace } from "../chart-utils";
import { SEGMENT_COLORS } from "../constants";
import { Sport } from "../types";
import { PaceSegmentChartTooltip } from "./PaceSegmentChart.tooltip";

export default function PaceSegmentChart({
	data,
	bands,
	selectedTime,
	pendingDistKm,
	highlightRange,
	onHover,
	onLeave,
	onChartClick,
}: {
	data: Sport.ChartPoint[];
	bands: Sport.Band[];
	selectedTime: number | null;
	pendingDistKm: number | null;
	highlightRange: Sport.HighlightRange | null;
	onHover: (point: TrackPoint) => void;
	onLeave: () => void;
	onChartClick: (point: Sport.ChartPoint) => void;
}) {
	return (
		<div>
			<div style={{ display: "flex", gap: 16, fontSize: "0.82em", color: "#aaa", margin: "4px 0" }}>
				<span>
					<span style={{ color: SEGMENT_COLORS.running }}>■</span> Course
				</span>
				<span>
					<span style={{ color: SEGMENT_COLORS.pause }}>■</span> Pause / marche
				</span>
				<span>Cliquer sur le graphique pour ajouter ou sélectionner un segment</span>
			</div>
			<ResponsiveContainer width="100%" height={160}>
				<ComposedChart
					data={data}
					onMouseMove={(state: any) => {
						const payload = data[parseInt(state.activeIndex, 10)] as Sport.ChartPoint | undefined;
						if (payload?.__point) onHover((payload as any).__point);
					}}
					onMouseLeave={onLeave}
					onClick={(state: any) => {
						const payload = data[parseInt(state.activeIndex, 10)] as Sport.ChartPoint | undefined;
						if (payload) onChartClick(payload);
					}}
				>
					<CartesianGrid strokeDasharray="3 3" stroke="#333" />
					<XAxis
						dataKey="distKm"
						type="number"
						domain={["dataMin", "dataMax"]}
						ticks={buildKmTicks(data)}
						tickFormatter={(v) => `${v} km`}
						tick={{ fontSize: 11 }}
					/>
					<YAxis
						type="number"
						yAxisId="pace"
						domain={[240, 600]}
						tickFormatter={formatPace}
						tick={{ fontSize: 11 }}
						tickLine={true}
						tickCount={7}
						ticks={[300, 360, 420, 480, 540, 600]}
						width={56}
						allowDataOverflow={true}
						reversed={true}
					/>
					<Tooltip content={<PaceSegmentChartTooltip bands={bands} />} />
					{highlightRange && (
						<ReferenceArea
							yAxisId="pace"
							x1={highlightRange.x1}
							x2={highlightRange.x2}
							fill="#ff6b35"
							fillOpacity={0.25}
							stroke="none"
						/>
					)}
					{bands.map((band) => (
						<ReferenceArea
							key={band.time}
							yAxisId="pace"
							x1={band.x1}
							x2={band.x2}
							fill={SEGMENT_COLORS[band.type]}
							fillOpacity={band.time === selectedTime ? 0.45 : 0.2}
							stroke={band.time === selectedTime ? SEGMENT_COLORS[band.type] : "none"}
							label={
								band.label
									? { value: band.label, position: "insideTop", fill: "#eee", fontSize: 10 }
									: undefined
							}
						/>
					))}
					{pendingDistKm != null && (
						<ReferenceLine yAxisId="pace" x={pendingDistKm} stroke="#fff" strokeDasharray="4 2" />
					)}
					<Line
						yAxisId="pace"
						dataKey="pace"
						stroke="#e0e0e0"
						strokeWidth={1.5}
						dot={false}
						isAnimationActive={false}
						connectNulls
					/>
				</ComposedChart>
			</ResponsiveContainer>
		</div>
	);
}
