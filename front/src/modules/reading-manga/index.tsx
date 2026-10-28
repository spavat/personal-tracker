import "../../App.css";
import "./module.css";
import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import SearchModal from "../../components/search-modal";
import Submenu from "../../components/submenu";
import { getMangas } from "./api";
import { linkItem, renderResultItem } from "./search-fn";

const links = [
	{
		link: "/reading-manga/history",
		label: "Historique",
		partial: true,
	},
	{
		link: "/reading-manga/list",
		label: "Liste",
	},
];

export default function AppReadingManga() {
	const [isSearchModalOpen, setSearchModalOpen] = useState<boolean>(false);

	useHotkeys("ctrl+shift+f", () => setSearchModalOpen(true), { preventDefault: true });

	return (
		<>
			<Submenu links={links} />

			<div className="module reading-manga">
				<Outlet />

				<SearchModal
					isOpen={isSearchModalOpen}
					onClose={() => setSearchModalOpen(false)}
					queryKey={["mangas"]}
					queryFn={(search: string) => getMangas({ search })}
					renderItem={renderResultItem}
					linkItem={linkItem}
				/>
			</div>
		</>
	);
}
