import "./module.css";
import { Outlet } from "@tanstack/react-router";

import PageTitle from "../../components/PageTitle";

export default function AppCalendar() {
	return (
		<>
			<PageTitle title="Calendrier"></PageTitle>
			<div className="module">
				<Outlet />
			</div>
		</>
	);
}
