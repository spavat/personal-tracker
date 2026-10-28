import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../../components/modal";
import MutationError from "../../../../components/mutation-error";
import { categoriesQuery, deleteCategory } from "../../api";

const REASON_LABELS: Record<string, string> = {
	has_children: "Cette catégorie a des sous-catégories. Supprimez-les ou déplacez-les avant de continuer.",
	in_use: "Des objets sont encore rattachés à cette catégorie. Déplacez-les avant de continuer.",
};

export default function DeleteCategoryModalForm({ id, returnTo }: { id: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: categories } = useSuspenseQuery(categoriesQuery());
	const category = categories.find((c) => c.id === id)!;

	const deleteMutation = useMutation({
		mutationFn: deleteCategory,
		onSuccess: (result) => {
			if (!result.deleted) {
				return;
			}
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

	const blockedReason = deleteMutation.data && !deleteMutation.data.deleted ? deleteMutation.data.reason : undefined;

	return (
		<Modal className="form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer la catégorie</h2>
			</div>
			<div className="dialog-body">
				<p>
					Êtes-vous sûr de vouloir supprimer la catégorie <strong>{category.name}</strong> ?
				</p>
				{blockedReason && <p className="error">{REASON_LABELS[blockedReason] ?? "Suppression impossible."}</p>}
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
