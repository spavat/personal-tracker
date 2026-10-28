import "../../App.css";
import { Outlet } from "@tanstack/react-router";

import "./module.css";
import Submenu from "../../components/submenu";

const links = [
	{
		link: "/reading-book/history",
		label: "Historique",
		partial: true,
	},
	{
		link: "/reading-book/list",
		label: "Liste",
	},
];

export default function AppReadingBook() {
	return (
		<>
			<Submenu links={links} />

			<div className="module reading-book">
				<Outlet />
			</div>
		</>
	);
}
