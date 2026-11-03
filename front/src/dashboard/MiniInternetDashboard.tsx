import { useSuspenseQuery } from "@tanstack/react-query";

import { MusicPreviousDays } from "../charts/MusicPreviousDays";
import { getFortnightStats } from "../modules/internet/api";
export default function MiniInternetDashboard() {
	const { data } = useSuspenseQuery({
		queryKey: ["internet", "fortnight"],
		queryFn: getFortnightStats,
	});
	return (
		<div>
			<p>Ecoute/Visionnage durant les 2 semaines</p>
			<MusicPreviousDays data={data} />
		</div>
	);
}
