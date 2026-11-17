import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
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
		<Modal className={"modal form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer le modèle</h2>
			</div>
			<div className="dialog-body">
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
				<MutationError error={deleteMutation.error} />
			</div>
			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Annuler
				</button>
				{!isUsedByReadEdition && (
					<button
						type="submit"
						className="main"
						onClick={() => deleteMutation.mutate({ id: bookId, modelId })}
						disabled={deleteMutation.isPending}
					>
						Supprimer
					</button>
				)}
			</div>
		</Modal>
	);
}
