import "../../App.css";
import { Outlet } from "@tanstack/react-router";

import "./module.css";
import Submenu from "../../components/submenu";

const links = [
	{
		link: "/sport/history",
		label: "Historique",
		partial: true,
	},
	{
		link: "/sport/list",
		label: "Liste",
	},
];

export default function AppSport() {
	return (
		<>
			<Submenu links={links} />
			<div className="module sport">
				<Outlet />
			</div>
		</>
	);
}
