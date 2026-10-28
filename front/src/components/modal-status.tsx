import { type ErrorComponentProps, useNavigate, useRouter, useSearch } from "@tanstack/react-router";

import Modal from "./modal";

// pendingComponent of the modal routes: an empty modal while the form data loads
export function ModalPending() {
	return (
		<Modal className="form dialog-medium" isOpen={true}>
			<div className="dialog-body">
				<div className="empty-state">
					<p>
						<i className="fa-solid fa-hourglass fa-2xl"></i>
					</p>
					<p>Chargement en cours&hellip;</p>
				</div>
			</div>
		</Modal>
	);
}

// errorComponent of the modal routes: keeps the error in a modal, where the user is looking
export function ModalError({ error }: ErrorComponentProps) {
	const navigate = useNavigate();
	const router = useRouter();
	// every modal route validates a `returnTo` search param (withReturnToSchema)
	const returnTo = useSearch({
		strict: false,
		select: (search) => (search as { returnTo?: string } | undefined)?.returnTo,
	});

	function closeModal() {
		navigate({ to: returnTo ?? "..", replace: true, resetScroll: false });
	}

	return (
		<Modal className="form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Erreur</h2>
			</div>
			<div className="dialog-body">
				<div className="empty-state">
					<p>
						<i className="fa-solid fa-triangle-exclamation fa-2xl"></i>
					</p>
					<p>Impossible de charger les données.</p>
					<p className="smalltext">{error instanceof Error && error.message}</p>
				</div>
			</div>
			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Fermer
				</button>
				{/* re-runs the route loaders */}
				<button type="button" className="main" onClick={() => router.invalidate()}>
					Réessayer
				</button>
			</div>
		</Modal>
	);
}
