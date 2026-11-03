import { BarChart, Bar, Rectangle, XAxis, Tooltip, ResponsiveContainer } from "recharts";

export const MusicReleaseYear = ({ data }: any) => {
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
				<XAxis dataKey="name" interval={1} />
				<Tooltip wrapperStyle={{ width: 200, backgroundColor: "#FFFFFF" }} />
				<Bar
					dataKey="duration"
					fill="#82ca9d"
					activeBar={<Rectangle fill="gold" stroke="purple" />}
					label={{ position: "top" }}
				/>
			</BarChart>
		</ResponsiveContainer>
	);
};
