import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { bookDetailsQuery, deleteEdition } from "../api";

export default function DeleteEditionModalForm({
	bookId,
	editionId,
	returnTo,
}: {
	bookId: string;
	editionId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: book } = useSuspenseQuery(bookDetailsQuery(bookId));
	const edition = book.editions.find(({ id }) => id === editionId)!;

	const deleteMutation = useMutation({
		mutationFn: deleteEdition,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reading", "books"] });
			closeModal();
		},
	});

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	// the server refuses both cases: said before trying
	const reason =
		edition.readings.length > 0
			? "Cette édition a des lectures : supprimez-les d'abord."
			: book.editions.length === 1
				? "Un livre garde au moins une édition."
				: null;

	return (
		<ConfirmDeleteModal
			title="Supprimer l'édition"
			onClose={closeModal}
			onConfirm={() => deleteMutation.mutate({ id: bookId, editionId })}
			mutation={deleteMutation}
			canDelete={!reason}
		>
			<p>
				{reason ?? (
					<>
						Êtes-vous sûr de vouloir supprimer l'édition <strong>{edition.title ?? book.book}</strong> ?
					</>
				)}
			</p>
		</ConfirmDeleteModal>
	);
}
