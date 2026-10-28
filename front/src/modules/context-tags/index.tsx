import "../../App.css";
import { Outlet } from "@tanstack/react-router";

import "./module.css";

export default function AppContextTags() {
	return (
		<div className="module context-tags">
			<Outlet />
		</div>
	);
}
