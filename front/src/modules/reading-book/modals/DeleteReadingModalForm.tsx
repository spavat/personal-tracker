import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
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

	const reading = data.readings.find((r: any) => r.id === readingId)!;

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
		<Modal className={"modal form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer lecture</h2>
			</div>
			<div className="dialog-body">
				<p>
					Êtes-vous sûr de vouloir supprimer la lecture ?
					<br />
					Cette lecture contient <strong>{reading.details.length}</strong> entrée(s).
				</p>
				<MutationError error={deleteReadingMutation.error} />
			</div>

			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Annuler
				</button>
				<button
					type="submit"
					className="main"
					onClick={deleteAndClose}
					disabled={deleteReadingMutation.isPending}
				>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
