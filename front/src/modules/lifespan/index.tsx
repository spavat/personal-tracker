import { Outlet } from "@tanstack/react-router";

import "../../App.css";
import "./module.css";
import Submenu from "../../components/submenu";

const links = [
	{
		link: "/lifespan/timeline",
		label: "Timeline",
		partial: true,
	},
	{
		link: "/lifespan/list",
		label: "Liste",
		partial: true,
	},
	{
		link: "/lifespan/categories",
		label: "Catégories",
		partial: true,
	},
];

export default function AppLifespan() {
	return (
		<>
			<Submenu links={links} />
			<div className="module lifespan">
				<Outlet />
			</div>
		</>
	);
}
