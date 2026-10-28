import { Outlet } from "@tanstack/react-router";
import { useState } from "react";

import "../../App.css";
import "./module.css";
import { useHotkeys } from "react-hotkeys-hook";

import SearchModal from "../../components/search-modal";
import Submenu from "../../components/submenu";
import { search } from "./api";
import { linkItem, renderShowResultItem } from "./search-fn";

const links = [
	{
		link: "/shows/history",
		label: "Historique",
		partial: true,
	},
	{
		link: "/shows/performances",
		label: "Représentations",
	},
	{
		link: "/shows/spectacles",
		label: "Spectacles",
	},
	{
		link: "/shows/works",
		label: "Oeuvres",
	},
	{
		link: "/shows/artists",
		label: "Artistes",
	},
	{
		link: "/shows/places",
		label: "Lieux",
	},
];

export default function AppShows() {
	const [isSearchProgramModalOpen, setSearchProgramModalOpen] = useState<boolean>(false);

	useHotkeys("ctrl+shift+f", () => setSearchProgramModalOpen(true), { preventDefault: true });

	return (
		<>
			<Submenu links={links} />

			<div className="module shows">
				<Outlet />

				<SearchModal
					isOpen={isSearchProgramModalOpen}
					onClose={() => setSearchProgramModalOpen(false)}
					queryKey={["shows"]}
					queryFn={search}
					renderItem={renderShowResultItem}
					linkItem={linkItem}
				/>
			</div>
		</>
	);
}
