import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Fragment } from "react";

import { authClient } from "../auth/auth-client";
import { isPublicPath } from "../auth/public-paths";
import { useStoredValue } from "../hooks/stored-value";
import { useIsOwner } from "../hooks/use-is-owner";
import { navSections } from "./nav-items";

const SIDEBAR_COLLAPSED_KEY = "tracker_sidebar_collapsed";

function isActive(pathname: string, itemPath: string) {
	// the home page and its owner-only dashboard tab
	return itemPath === "/" ? pathname === "/" || pathname === "/dashboard" : pathname.startsWith(itemPath);
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
	// a section whose items are all hidden is dropped, title included
	const sections = navSections
		.map((section) => ({
			...section,
			items: section.items.filter((item) => isOwner || isPublicPath(item.path)),
		}))
		.filter((section) => section.items.length > 0);

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
					{sections.map((section, index) => (
						<Fragment key={section.title ?? index}>
							{section.title && (
								<li className="sidebar-section-title" title={section.title}>
									{!collapsed && section.title}
								</li>
							)}
							{section.items.map((item) => (
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
						</Fragment>
					))}
				</ul>
				<ul className="sidebar-nav sidebar-nav-secondary" onClick={onCloseMobile}>
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
