import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { bookDetailsQuery, deleteModel } from "../api";

export default function DeleteModelModalForm({
	bookId,
	modelId,
	returnTo,
}: {
	bookId: string;
	modelId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: book } = useSuspenseQuery(bookDetailsQuery(bookId));
	const model = book.models.find(({ id }) => id === modelId)!;
	const editions = book.editions.filter((edition) => edition.modelId === modelId);
	const editionName = (edition: (typeof editions)[number]) => edition.title ?? "Édition";

	const deleteMutation = useMutation({
		mutationFn: deleteModel,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reading", "books"] });
			closeModal();
		},
	});

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	// the server refuses it: said before trying
	const isUsedByReadEdition = editions.some((edition) => edition.readings.length > 0);

	return (
		<ConfirmDeleteModal
			title="Supprimer le modèle"
			onClose={closeModal}
			onConfirm={() => deleteMutation.mutate({ id: bookId, modelId })}
			mutation={deleteMutation}
			canDelete={!isUsedByReadEdition}
		>
			{isUsedByReadEdition ? (
				<p>Ce modèle est utilisé par une édition qui a des lectures : il ne peut pas être supprimé.</p>
			) : (
				<p>
					Êtes-vous sûr de vouloir supprimer le modèle <strong>{model.name}</strong> ?
					{editions.length > 0 && (
						<>
							<br />
							Ces éditions n'auront plus de modèle : {editions.map(editionName).join(", ")}.
						</>
					)}
				</p>
			)}
		</ConfirmDeleteModal>
	);
}
