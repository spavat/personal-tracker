import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, BarShapeProps, Rectangle } from "recharts";

export const MusicGenres = ({
	data,
	reversed = false,
	setSelected,
}: {
	data: any;
	reversed?: boolean;
	setSelected?: (val: string) => void;
}) => {
	const top = data?.[0]?.duration ?? 0;

	const [key, setKey] = useState<string>("");
	const height = data.length * 20 + 50;
	const nbTick = Math.ceil(top / 600) + 1;

	const renderCell = (props: BarShapeProps) => {
		return <Rectangle {...props} cursor="pointer" fill={key === props.name ? "#82ca9d" : "#1884d8"} />;
	};

	return (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart data={data} width={1000} height={height} layout="vertical">
				<XAxis dataKey="duration" type="number" tickCount={5} domain={[0, nbTick * 600]} reversed={reversed} />
				<YAxis
					dataKey="name"
					type="category"
					width={200}
					interval={0}
					orientation={reversed ? "right" : "left"}
				/>
				<Bar
					dataKey="duration"
					fill="pink"
					label={{ position: "right" }}
					onClick={(e) => {
						if (setSelected) {
							setKey(e.name ?? ""); // TODO why ?? ""
							setSelected?.(e.name ?? ""); // TODO why ?? ""
						}
					}}
					shape={renderCell}
				></Bar>
				{Array.from({ length: nbTick }).map((_, i) => (
					<ReferenceLine key={i} x={600 * i} stroke="grey" strokeDasharray="3 3" />
				))}
			</BarChart>
		</ResponsiveContainer>
	);
};
