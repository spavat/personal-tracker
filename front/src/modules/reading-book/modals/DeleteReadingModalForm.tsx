import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { bookDetailsQuery, deleteReading } from "../api";

export default function DeleteReadingModalForm({
	bookId,
	readingId,
	returnTo,
}: {
	bookId: string;
	readingId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const deleteReadingMutation = useMutation({
		mutationFn: deleteReading,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reading", "books", bookId] });
			closeModal();
		},
	});
	const { data } = useSuspenseQuery(bookDetailsQuery(bookId));

	const reading = data.editions.flatMap((edition) => edition.readings).find((r) => r.id === readingId)!;

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	function deleteAndClose() {
		if (bookId && readingId) {
			deleteReadingMutation.mutate({
				id: bookId,
				readingId,
			});
		} else {
			console.error("Book ID and Reading ID must be provided", {
				id: bookId,
				readingId,
			});
		}
	}

	return (
		<ConfirmDeleteModal
			title="Supprimer lecture"
			onClose={closeModal}
			onConfirm={deleteAndClose}
			mutation={deleteReadingMutation}
		>
			<p>
				Êtes-vous sûr de vouloir supprimer la lecture ?
				<br />
				Cette lecture contient <strong>{reading.details.length}</strong> entrée(s).
			</p>
		</ConfirmDeleteModal>
	);
}
