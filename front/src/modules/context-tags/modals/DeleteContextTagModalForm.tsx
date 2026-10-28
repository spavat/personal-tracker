import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { contextTagsQuery, deleteItem } from "../api";

export default function DeleteContextTagModalForm({ id, returnTo }: { id: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: contextTags } = useSuspenseQuery(contextTagsQuery());
	const contextTag = contextTags.find((c) => c.id === id)!;

	const deleteMutation = useMutation({
		mutationFn: deleteItem,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["context-tags"] });
			closeModal();
		},
	});

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	function confirmDelete() {
		deleteMutation.mutate({ id });
	}

	return (
		<Modal className="form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer le tag principal</h2>
			</div>
			<div className="dialog-body">
				<p>
					Êtes-vous sûr de vouloir supprimer le tag principal <strong>{contextTag.name}</strong> ?
				</p>
				<MutationError error={deleteMutation.error} />
			</div>
			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Annuler
				</button>
				<button type="button" className="main" onClick={confirmDelete} disabled={deleteMutation.isPending}>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
