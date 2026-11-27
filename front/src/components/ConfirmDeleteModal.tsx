import Modal from "./Modal";
import MutationError from "./MutationError";

export default function ConfirmDeleteModal({
	title,
	onClose,
	onConfirm,
	mutation,
	canDelete = true,
	children,
}: {
	title: string;
	onClose: () => void;
	onConfirm: () => void;
	mutation: { error: Error | null; isPending: boolean };
	canDelete?: boolean;
	children: React.ReactNode;
}) {
	return (
		<Modal className="modal form dialog-medium" isOpen={true} onClose={onClose} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">{title}</h2>
			</div>
			<div className="dialog-body">
				{children}
				<MutationError error={mutation.error} />
			</div>
			<div className="dialog-footer">
				<button type="button" onClick={onClose}>
					Annuler
				</button>
				<button type="button" className="main" onClick={onConfirm} disabled={!canDelete || mutation.isPending}>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
