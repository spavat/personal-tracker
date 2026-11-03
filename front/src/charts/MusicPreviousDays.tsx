import { BarChart, Bar, XAxis, LabelList, Rectangle, type BarShapeProps } from "recharts";

import { getDurationString } from "../utils";

const renderCustomizedLabel = (props: any) => {
	const { x, y, width, value } = props;
	const radius = 10;

	return (
		<g>
			<text x={x + width / 2} y={y - radius} fill="#fff" textAnchor="middle" dominantBaseline="middle">
				{getDurationString(value)}
			</text>
		</g>
	);
};

const MyCustomRectangle = (props: BarShapeProps) => {
	// return <Rectangle {...props} fill={props.name === key ? "#82ca9d" : "#8884d8"} cursor="pointer" />;
	return <Rectangle {...props} fill={"#8884d8"} />;
};

export const MusicPreviousDays = ({ data }: any) => {
	return (
		<BarChart
			data={data}
			responsive
			width="100%"
			height={400}
			margin={{
				top: 5,
				right: 30,
				left: 20,
				bottom: 5,
			}}
		>
			<XAxis dataKey="date" />
			<Bar
				dataKey="duration"
				fill="#82ca9d"
				// label={{ fill: "black", position: "insideTop" }}
				shape={MyCustomRectangle}
			>
				<LabelList dataKey="duration" position="top" content={renderCustomizedLabel} />
			</Bar>
		</BarChart>
	);
};
