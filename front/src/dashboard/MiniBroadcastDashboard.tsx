import { useSuspenseQuery } from "@tanstack/react-query";

import { MusicPreviousDays } from "../charts/MusicPreviousDays";
import { getFortnightStats } from "../modules/broadcast/api";
export default function MiniBroadcastDashboard() {
	const { data } = useSuspenseQuery({
		queryKey: ["broadcast", "fortnight"],
		queryFn: getFortnightStats,
	});
	return (
		<div>
			<p>Ecoute/Visionnage durant les 2 semaines</p>
			<MusicPreviousDays data={data} />
		</div>
	);
}
