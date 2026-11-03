import { memo } from "react";
import { BarChart, Bar, XAxis, ResponsiveContainer, LabelList } from "recharts";

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

export const MusicYear = memo(({ data }: any) => {
	return (
		<ResponsiveContainer width="100%" height={300}>
			<BarChart
				data={data}
				margin={{
					top: 5,
					right: 30,
					left: 20,
					bottom: 5,
				}}
			>
				<XAxis dataKey="name" />
				<Bar dataKey="duration" fill="#8884d8">
					<LabelList dataKey="duration" position="top" content={renderCustomizedLabel} />
				</Bar>
			</BarChart>
		</ResponsiveContainer>
	);
});
