import { Outlet, useLocation } from "@tanstack/react-router";

import "./App.css";
import { useEffect, useRef, useState } from "react";

import { mainNavItems, moneyNavItem } from "./components/nav-items";
import PageTitle from "./components/PageTitle";
import Sidebar from "./components/Sidebar";
import { APP_VERSION, BUILD_DATE } from "./config";
import { useHeaderSlot } from "./hooks/use-header-slot";

const allNavItems = [...mainNavItems, moneyNavItem];

export default function App() {
	const location = useLocation();
	const route = allNavItems.find((item) => item.path !== "/" && location.pathname.startsWith(item.path));

	const ref = useRef(null);
	const headerSlot = useHeaderSlot();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	useEffect(() => {
		headerSlot?.setSlotNode?.(ref.current);
	}, [headerSlot]);

	return (
		<div className="app-layout">
			<Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
			<div className="app-content">
				<PageTitle />
				<div className="app-header">
					<button
						type="button"
						className="mobile-menu-toggle"
						onClick={() => setMobileMenuOpen(true)}
						title="Afficher le menu"
					>
						☰
					</button>
					{route ? (
						<h1>
							<span className="hide-on-mobile">Personal Tracker : </span>
							{route.title}
							{/* {route.icon} */}
						</h1>
					) : (
						<h1>Personal Tracker</h1>
					)}
					<div ref={ref} className="header-actions" />
				</div>
				<main>
					<Outlet />
				</main>
				<footer className="footer">
					© 2026 spavat
					<small className="app-version">
						{APP_VERSION ? (
							<a href={`https://github.com/spavat/personal-tracker/commit/${APP_VERSION}`}>
								{APP_VERSION.slice(0, 7)}
							</a>
						) : (
							"dev"
						)}
						{BUILD_DATE && ` · ${new Date(BUILD_DATE).toLocaleDateString("fr-FR")}`}
					</small>
				</footer>
			</div>
		</div>
	);
}
