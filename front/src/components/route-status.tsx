import type { ErrorComponentProps } from "@tanstack/react-router";

export function RoutePending() {
	return (
		<div className="empty-state">
			<p>
				<i className="fa-solid fa-hourglass fa-2xl"></i>
			</p>
			<p>Chargement en cours&hellip;</p>
		</div>
	);
}

export function RouteError({ error }: ErrorComponentProps) {
	return (
		<div className="empty-state">
			<p>
				<i className="fa-solid fa-hourglass fa-2xl"></i>
			</p>
			<p>Erreur ! {error instanceof Error && error.message}</p>
		</div>
	);
}
