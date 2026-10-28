import "../../App.css";
import { Outlet } from "@tanstack/react-router";

import "./money.css";
import { useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import Submenu from "../../components/submenu";
import SearchTransactionForm from "./SearchTransactionForm";

const links = [
	{
		link: "/money",
		label: "Aperçu",
	},
	{
		link: "/money/transactions",
		label: "Transactions",
	},
	{
		link: "/money/reports",
		label: "Récap",
	},
	{
		link: "/money/analytics",
		label: "Analytique",
	},
	{
		link: "/money/categories",
		label: "Catégories",
		icon: "fa-solid fa-gears",
	},
	{
		link: "/money/accounts",
		label: "Comptes",
		icon: "fa-solid fa-gears",
	},
	{
		link: "/money/tags",
		label: "Tags",
		icon: "fa-solid fa-gears",
	},
];

export default function AppMoney() {
	const [isSearchModalOpen, setSearchModalOpen] = useState<boolean>(false);

	useHotkeys("ctrl+shift+f", () => setSearchModalOpen(true), { preventDefault: true });
	return (
		<>
			<Submenu links={links} />
			<div className="module money">
				<Outlet />
			</div>
			<SearchTransactionForm isOpen={isSearchModalOpen} onClose={() => setSearchModalOpen(false)} />
		</>
	);
}
