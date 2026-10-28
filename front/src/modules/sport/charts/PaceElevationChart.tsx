import { TrackPoint } from "@personal-tracker/shared/sport";
import {
	Area,
	CartesianGrid,
	ComposedChart,
	Line,
	ReferenceArea,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import { buildKmTicks, formatPace } from "../chart-utils";
import { Sport } from "../types";
import PaceElevationChartTooltip from "./PaceElevationChart.tooltip";

export default function PaceElevationChart({
	data,
	highlightRange,
	onHover,
	onLeave,
}: {
	data: Sport.ChartPoint[];
	highlightRange: Sport.HighlightRange | null;
	onHover: (point: TrackPoint) => void;
	onLeave: () => void;
}) {
	return (
		<div>
			<ResponsiveContainer width="100%" height={200}>
				<ComposedChart
					data={data}
					onMouseMove={(state: any) => {
						const payload = data[parseInt(state.activeIndex, 10)] as Sport.ChartPoint | undefined;
						if (payload?.__point) onHover((payload as any).__point);
					}}
					onMouseLeave={onLeave}
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
						yAxisId="ele"
						orientation="left"
						domain={["auto", "auto"]}
						tick={{ fontSize: 11 }}
						unit=" m"
						width={44}
					/>
					<YAxis
						type="number"
						yAxisId="pace"
						orientation="right"
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
					<Tooltip content={<PaceElevationChartTooltip />} />
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
					<Area
						yAxisId="ele"
						dataKey="ele"
						fill="#4a4a4a"
						fillOpacity={0.45}
						stroke="#888"
						strokeWidth={0.5}
						dot={false}
						isAnimationActive={false}
						connectNulls
					/>
					<Line
						yAxisId="pace"
						dataKey="pace"
						stroke="#4a9eff"
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
