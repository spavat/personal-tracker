import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import "../../App.css";
import "./module.css";

import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import SearchModal from "../../components/SearchModal";
import Submenu from "../../components/Submenu";
import { useIsOwner } from "../../hooks/use-is-owner";
import { searchMusic } from "./api";
import { linkItem, renderResultItem } from "./search-fn";

const links = [
	{
		link: "/music/history",
		label: "Historique",
		partial: true,
	},
	{
		link: "/music/list",
		label: "Liste",
		partial: true,
	},
	{
		link: "/music/stats",
		label: "Statistiques",
		partial: true,
	},
	{
		link: "/music/genres",
		label: "Genres",
		partial: true,
		ownerOnly: true,
	},
];

export default function AppMusic() {
	const navigate = useNavigate();
	const location = useLocation();
	const isOwner = useIsOwner();
	const [isSearchModalOpen, setSearchModalOpen] = useState<boolean>(false);

	useHotkeys(
		"ctrl+shift+n",
		(e) => {
			e.preventDefault();
			navigate({
				to: `${location.pathname}/add`,
				search: { returnTo: location.pathname },
				replace: true,
				resetScroll: false,
			});
		},
		{ enabled: isOwner },
	);
	useHotkeys("ctrl+shift+f", () => setSearchModalOpen(true), { preventDefault: true });

	function clickItem(item: any) {
		navigate({
			to: `${location.pathname}/add`,
			search: { returnTo: location.pathname, copyObject: item },
			replace: true,
			resetScroll: false,
			mask: {
				to: location.pathname,
			},
		});
	}

	return (
		<>
			<Submenu links={links.filter((link) => isOwner || !link.ownerOnly)} />
			<div className="module music">
				<Outlet />
				<SearchModal
					isOpen={isSearchModalOpen}
					onClose={() => setSearchModalOpen(false)}
					queryKey={["music", "listenings"]}
					queryFn={searchMusic}
					renderItem={renderResultItem}
					linkItem={linkItem}
					clickItem={isOwner ? clickItem : undefined}
				/>
			</div>
		</>
	);
}
