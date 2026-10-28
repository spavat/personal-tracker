import type { ReactNode } from "react";

// Dims its content and shows a centered message while a transition is loading (e.g. regrouping a table)
export function PendingContent({ isPending, children }: { isPending: boolean; children: ReactNode }) {
	return (
		<div className={`pending-content${isPending ? " pending" : ""}`}>
			{children}
			{isPending && (
				<div className="pending-message">
					<p>
						<i className="fa-solid fa-hourglass"></i> Chargement en cours&hellip;
					</p>
				</div>
			)}
		</div>
	);
}
