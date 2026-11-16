import { useQuery } from "@tanstack/react-query";

import "../../App.css";
import "./module.css";

import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import SearchModal from "../../components/SearchModal";
import Submenu from "../../components/Submenu";
import { useIsOwner } from "../../hooks/use-is-owner";
import { getGameList, syncStatusQuery } from "./api";
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
	{
		link: "/game/merge",
		label: "Fusionner",
		partial: true,
		ownerOnly: true,
	},
];
const integrationsLink = { link: "/game/integrations", label: "Intégrations", partial: true };

export default function AppGame() {
	const isOwner = useIsOwner();
	const [isSearchodalOpen, setSearchModalOpen] = useState<boolean>(false);
	// a red marker when the latest fetch of a store failed (Epic token expired, profile private…)
	const { data: syncStatus } = useQuery({ ...syncStatusQuery(), enabled: isOwner });

	useHotkeys("ctrl+shift+f", () => setSearchModalOpen(true), { preventDefault: true });
	return (
		<>
			<Submenu
				links={[
					...links.filter((link) => isOwner || !link.ownerOnly),
					...(isOwner
						? [
								syncStatus?.lastRunFailed
									? { ...integrationsLink, icon: "fa-solid fa-circle-exclamation sync-error" }
									: integrationsLink,
							]
						: []),
				]}
			/>
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
