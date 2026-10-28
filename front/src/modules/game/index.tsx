import { Outlet } from "@tanstack/react-router";

import "../../App.css";
import "./module.css";

import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import SearchModal from "../../components/search-modal";
import Submenu from "../../components/submenu";
import { getGameList } from "./api";
import { linkItem, renderResultItem } from "./search-fn";

const links = [
	{
		link: "/game/history",
		label: "Historique",
		partial: true,
	},
	{
		link: "/game/list",
		label: "Liste",
		partial: true,
	},
];

export default function AppGame() {
	const [isSearchodalOpen, setSearchModalOpen] = useState<boolean>(false);

	useHotkeys("ctrl+shift+f", () => setSearchModalOpen(true), { preventDefault: true });
	return (
		<>
			<Submenu links={links} />
			<div className="module game">
				<Outlet />

				{isSearchodalOpen && (
					<SearchModal
						isOpen={isSearchodalOpen}
						onClose={() => setSearchModalOpen(false)}
						queryKey={["game"]}
						queryFn={getGameList}
						renderItem={renderResultItem}
						linkItem={linkItem}
					/>
				)}
			</div>
		</>
	);
}
