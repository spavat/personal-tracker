import "../../App.css";
import "./module.css";
import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import SearchModal from "../../components/search-modal";
import Submenu from "../../components/submenu";
import { getProgramList } from "./api";
import { linkItem, renderInternetResultItem } from "./search-fn";

const links = [
	{
		link: "/internet/history",
		label: "Historique",
		partial: true,
	},
	{
		link: "/internet/list",
		label: "Liste",
		partial: true,
	},
	{
		link: "/internet/stats",
		label: "Statistiques",
		partial: true,
	},
	{
		link: "/internet/sync",
		label: "Sync Podcast",
	},
];

export default function AppInternet() {
	const [isSearchProgramModalOpen, setSearchProgramModalOpen] = useState<boolean>(false);

	useHotkeys("ctrl+shift+f", () => setSearchProgramModalOpen(true), { preventDefault: true });
	return (
		<>
			<Submenu links={links} />

			<div className="module internet">
				<Outlet />

				<SearchModal
					isOpen={isSearchProgramModalOpen}
					onClose={() => setSearchProgramModalOpen(false)}
					queryKey={["programs"]}
					queryFn={getProgramList}
					renderItem={renderInternetResultItem}
					linkItem={linkItem}
				/>
			</div>
		</>
	);
}
