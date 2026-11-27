import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
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
		<ConfirmDeleteModal
			title="Supprimer le tag principal"
			onClose={closeModal}
			onConfirm={confirmDelete}
			mutation={deleteMutation}
		>
			<p>
				Êtes-vous sûr de vouloir supprimer le tag principal <strong>{contextTag.name}</strong> ?
			</p>
		</ConfirmDeleteModal>
	);
}
