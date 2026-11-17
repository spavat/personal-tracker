import "../../App.css";
import { Outlet } from "@tanstack/react-router";

import "./module.css";
import Submenu from "../../components/Submenu";

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
	{
		// strict: on an author's page it stays a link back to the list
		link: "/reading-book/authors",
		label: "Auteur·ices",
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
