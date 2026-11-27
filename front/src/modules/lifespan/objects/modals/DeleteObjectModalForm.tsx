import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../../components/ConfirmDeleteModal";
import { deleteObject, objectDetailsQuery } from "../../api";

export default function DeleteObjectModalForm({ id, returnTo }: { id: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: object } = useSuspenseQuery(objectDetailsQuery(id));

	const deleteMutation = useMutation({
		mutationFn: deleteObject,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lifespan", "objects"] });
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
		<ConfirmDeleteModal
			title="Supprimer l'objet"
			onClose={closeModal}
			onConfirm={confirmDelete}
			mutation={deleteMutation}
		>
			<p>
				Êtes-vous sûr de vouloir supprimer <strong>{object.name}</strong> et tout son historique ?
			</p>
		</ConfirmDeleteModal>
	);
}
