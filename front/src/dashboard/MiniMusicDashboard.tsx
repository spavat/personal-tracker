import { useSuspenseQuery } from "@tanstack/react-query";

import { MusicPreviousDays } from "../charts/music-previous-day";
import { getFortnightStats } from "../modules/music/api";

export default function MiniMusicDashboard() {
	const { data } = useSuspenseQuery({
		queryKey: ["music", "fortnight"],
		queryFn: getFortnightStats,
	});
	return (
		<div>
			<p>Ecoute durant les 2 semaines</p>
			<MusicPreviousDays data={data} />
		</div>
	);
}
