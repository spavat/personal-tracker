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
import { searchEntities } from "./api";
import { linkEntityItem, renderEntityResultItem } from "./search-fn";

export default function AppEntities() {
	const [isSearchModalOpen, setSearchModalOpen] = useState(false);

	useHotkeys("ctrl+shift+f", () => setSearchModalOpen(true), { preventDefault: true });

	return (
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
	);
}
