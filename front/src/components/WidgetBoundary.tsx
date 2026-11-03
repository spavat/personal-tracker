import type { ReactNode } from "react";

import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

// Loading + error boundary for one widget of a page, so it loads (or fails) independently of the others
export function WidgetBoundary({ children }: { children: ReactNode }) {
	return (
		<QueryErrorResetBoundary>
			{({ reset }) => (
				<ErrorBoundary
					onReset={reset}
					fallbackRender={({ resetErrorBoundary }) => (
						<p>
							Erreur !{" "}
							<button type="button" onClick={resetErrorBoundary}>
								Réessayer
							</button>
						</p>
					)}
				>
					<Suspense fallback={<p>Chargement&hellip;</p>}>{children}</Suspense>
				</ErrorBoundary>
			)}
		</QueryErrorResetBoundary>
	);
}
