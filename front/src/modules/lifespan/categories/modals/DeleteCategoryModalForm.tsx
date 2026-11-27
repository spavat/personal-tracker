import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../../components/ConfirmDeleteModal";
import { categoriesQuery, deleteCategory } from "../../api";

export default function DeleteCategoryModalForm({ id, returnTo }: { id: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: categories } = useSuspenseQuery(categoriesQuery());
	const category = categories.find((c) => c.id === id)!;

	const deleteMutation = useMutation({
		mutationFn: deleteCategory,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lifespan", "categories"] });
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
			title="Supprimer la catégorie"
			onClose={closeModal}
			onConfirm={confirmDelete}
			mutation={deleteMutation}
		>
			<p>
				Êtes-vous sûr de vouloir supprimer la catégorie <strong>{category.name}</strong> ?
			</p>
		</ConfirmDeleteModal>
	);
}
