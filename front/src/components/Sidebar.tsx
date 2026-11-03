import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";

import { authClient } from "../auth/auth-client";
import { isPublicPath } from "../auth/public-paths";
import { useStoredValue } from "../hooks/stored-value";
import { useIsOwner } from "../hooks/use-is-owner";
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
	const isOwner = useIsOwner();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const navItems = mainNavItems.filter((item) => isOwner || isPublicPath(item.path));

	function toggleCollapsed() {
		setCollapsed(!collapsed);
	}

	async function logout() {
		await authClient.signOut();
		// drop every cached private data, the session query included
		queryClient.clear();
		navigate({ to: "/" });
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
					{navItems.map((item) => (
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
					{(isOwner || isPublicPath(moneyNavItem.path)) && (
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
					)}
					<li>
						{isOwner ? (
							<a href="#" onClick={(event) => (event.preventDefault(), logout())} title="Se déconnecter">
								<span className="sidebar-icon">🔓</span>
								{!collapsed && <span className="sidebar-label">Se déconnecter</span>}
							</a>
						) : (
							<Link
								to="/login"
								className={isActive(location.pathname, "/login") ? "active" : ""}
								title="Se connecter"
							>
								<span className="sidebar-icon">🔒</span>
								{!collapsed && <span className="sidebar-label">Se connecter</span>}
							</Link>
						)}
					</li>
				</ul>
				<button
					type="button"
					className="sidebar-toggle hide-on-mobile"
					onClick={toggleCollapsed}
					title={collapsed ? "Afficher le menu" : "Masquer le menu"}
				>
					{collapsed ? "»" : "«"}
				</button>
			</nav>
		</>
	);
}
