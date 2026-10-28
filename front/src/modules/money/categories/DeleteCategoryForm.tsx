import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
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
		<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer la catégorie "{data.name}"</h2>
			</div>
			<div className="dialog-body">
				<p>
					Sous catégorie associée à "{data.name}" ?{" "}
					{nbSubCategories ? <>❌ {nbSubCategories} sous catégorie(s)</> : "✅ Aucune"}
				</p>
				<p>
					Transactions utilisant cette catégorie ?{" "}
					{nbTransactions ? <>❌ {nbTransactions} trouvées </> : "✅"}
				</p>
				<MutationError error={deleteMutation.error} />
			</div>

			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Fermer
				</button>
				<button
					type="submit"
					className="main"
					onClick={save}
					disabled={Boolean(nbSubCategories || nbTransactions) || deleteMutation.isPending}
				>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
