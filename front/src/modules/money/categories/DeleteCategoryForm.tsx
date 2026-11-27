import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { categoryQuery, deleteCategory } from "../api";

interface Form {
	categoryId: number;
	returnTo: string;
}

export default function DeleteCategoryForm({ categoryId, returnTo }: Form) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data } = useSuspenseQuery(categoryQuery(categoryId));
	const deleteMutation = useMutation({
		mutationFn: deleteCategory,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["money", "categories"] });
			closeModal();
		},
	});

	function save() {
		deleteMutation.mutate(categoryId);
	}

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const nbSubCategories = data.children.length;
	const nbTransactions = data.transactions;

	return (
		<ConfirmDeleteModal
			title={`Supprimer la catégorie "${data.name}"`}
			onClose={closeModal}
			onConfirm={save}
			mutation={deleteMutation}
			canDelete={!(nbSubCategories || nbTransactions)}
		>
			<p>
				Sous catégorie associée à "{data.name}" ?{" "}
				{nbSubCategories ? <>❌ {nbSubCategories} sous catégorie(s)</> : "✅ Aucune"}
			</p>
			<p>Transactions utilisant cette catégorie ? {nbTransactions ? <>❌ {nbTransactions} trouvées </> : "✅"}</p>
		</ConfirmDeleteModal>
	);
}
