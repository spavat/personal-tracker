import { lazy } from "react";

import { WidgetBoundary } from "../components/widget-boundary";
import MiniMusicalDashboard from "./MiniMusicalDashboard";
import MiniReadingDashboard from "./MiniReadingDashboard";

// recharts is heavy: loaded with these widgets, after the rest of the dashboard
const MiniMusicDashboard = lazy(() => import("./MiniMusicDashboard"));
const MiniInternetDashboard = lazy(() => import("./MiniInternetDashboard"));

export default function MainDashboard() {
	const now = Temporal.Now.plainDateISO();
	const year = String(now.year);
	const days = now.dayOfYear + 1;

	return (
		<div className="stats">
			<p>
				Année {year} soit {days} jours
			</p>

			<h2>Musique</h2>
			<WidgetBoundary>
				<MiniMusicDashboard />
			</WidgetBoundary>

			<h2>Internet</h2>
			<WidgetBoundary>
				<MiniInternetDashboard />
			</WidgetBoundary>

			<h2>Lecture / Livres</h2>
			<WidgetBoundary>
				<MiniReadingDashboard year={year} />
			</WidgetBoundary>

			<h2>Spectacles</h2>
			<WidgetBoundary>
				<MiniMusicalDashboard year={year} />
			</WidgetBoundary>
		</div>
	);
}
