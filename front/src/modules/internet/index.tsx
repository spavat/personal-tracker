import "../../App.css";
import "./module.css";
import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import SearchModal from "../../components/SearchModal";
import Submenu from "../../components/Submenu";
import { useIsOwner } from "../../hooks/use-is-owner";
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
		ownerOnly: true,
	},
	{
		link: "/internet/review",
		label: "Review Tag",
		icon: "fa-solid fa-gear",
		partial: true,
		ownerOnly: true,
	},
];

export default function AppInternet() {
	const isOwner = useIsOwner();
	const [isSearchProgramModalOpen, setSearchProgramModalOpen] = useState<boolean>(false);

	useHotkeys("ctrl+shift+f", () => setSearchProgramModalOpen(true), { preventDefault: true });
	return (
		<>
			<Submenu links={links.filter((link) => isOwner || !link.ownerOnly)} />

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
