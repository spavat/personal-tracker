import { Link, useLocation } from "@tanstack/react-router";

import { useStoredValue } from "../hooks/stored-value";
import { mainNavItems, moneyNavItem } from "./nav-items";

const SIDEBAR_COLLAPSED_KEY = "tracker_sidebar_collapsed";

function isActive(pathname: string, itemPath: string) {
	return itemPath === "/" ? pathname === "/" : pathname.startsWith(itemPath);
}

interface SidebarProps {
	mobileOpen: boolean;
	onCloseMobile: () => void;
}

export default function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
	const location = useLocation();
	const [collapsed, setCollapsed] = useStoredValue(SIDEBAR_COLLAPSED_KEY, false);

	function toggleCollapsed() {
		setCollapsed(!collapsed);
	}

	return (
		<>
			{mobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
			<nav
				className={`sidebar${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}
				onDoubleClick={toggleCollapsed}
			>
				<div className="sidebar-header">
					<span className="sidebar-logo">📊</span>
					{!collapsed && <span className="sidebar-app-title">Personal Tracker</span>}
				</div>
				<ul className="sidebar-nav" onClick={onCloseMobile}>
					{mainNavItems.map((item) => (
						<li key={item.path}>
							<Link
								to={item.path}
								className={isActive(location.pathname, item.path) ? "active" : ""}
								title={item.title}
							>
								<span className="sidebar-icon">{item.icon}</span>
								{!collapsed && <span className="sidebar-label">{item.title}</span>}
							</Link>
						</li>
					))}
				</ul>
				<ul className="sidebar-nav sidebar-nav-secondary" onClick={onCloseMobile}>
					<li>
						<Link
							to={moneyNavItem.path}
							className={isActive(location.pathname, moneyNavItem.path) ? "active" : ""}
							title={moneyNavItem.title}
						>
							<span className="sidebar-icon">{moneyNavItem.icon}</span>
							{!collapsed && <span className="sidebar-label">{moneyNavItem.title}</span>}
						</Link>
					</li>
				</ul>
				<button
					type="button"
					className="sidebar-toggle"
					onClick={toggleCollapsed}
					title={collapsed ? "Afficher le menu" : "Masquer le menu"}
				>
					{collapsed ? "»" : "«"}
				</button>
			</nav>
		</>
	);
}
