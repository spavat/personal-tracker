import { Outlet } from "@tanstack/react-router";

import Submenu from "../../components/Submenu";
import { useIsOwner } from "../../hooks/use-is-owner";

const links = [
	{ link: "/", label: "Accueil" },
	{ link: "/dashboard", label: "Dashboard" },
];

// the dashboard reads private data: only the owner gets the submenu
export default function AppHome() {
	return (
		<>
			{useIsOwner() && <Submenu links={links} />}
			<Outlet />
		</>
	);
}
