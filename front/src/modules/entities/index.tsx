import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import "../../App.css";
import "./module.css";
// the details page shows the sections of these modules, under their own class
import "../broadcast/module.css";
import "../reading-book/module.css";
import "../show/module.css";
import SearchModal from "../../components/SearchModal";
import Submenu from "../../components/Submenu";
import { useIsOwner } from "../../hooks/use-is-owner";
import { searchEntities } from "./api";
import { linkEntityItem, renderEntityResultItem } from "./search-fn";

const links = [
	{ link: "/entities", label: "Liste" },
	{ link: "/entities/merge", label: "Fusionner", ownerOnly: true },
];

export default function AppEntities() {
	const isOwner = useIsOwner();
	const [isSearchModalOpen, setSearchModalOpen] = useState(false);

	useHotkeys("ctrl+shift+f", () => setSearchModalOpen(true), { preventDefault: true });

	return (
		<>
			<Submenu links={links.filter((link) => isOwner || !link.ownerOnly)} />
			<div className="module entities">
				<Outlet />

				<SearchModal
					isOpen={isSearchModalOpen}
					onClose={() => setSearchModalOpen(false)}
					queryKey={["entities", "search"]}
					queryFn={searchEntities}
					renderItem={renderEntityResultItem}
					linkItem={linkEntityItem}
				/>
			</div>
		</>
	);
}
