import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { formatDate } from "../../../utils";
import { deleteItem, listeningDetailsQuery } from "../api";

export default function DeleteListeningModalForm({ listeningId, returnTo }: { listeningId: string; returnTo: string }) {
	const navigate = useNavigate();

	const queryClient = useQueryClient();

	const saveMutation = useMutation({
		mutationFn: deleteItem,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["music", "listenings"] });
			closeModal();
		},
	});

	const { data: listening } = useSuspenseQuery(listeningDetailsQuery(listeningId));

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	function deleteAndClose() {
		saveMutation.mutate({
			id: listeningId,
		});
	}

	return (
		<ConfirmDeleteModal
			title="Supprimer une écoute"
			onClose={closeModal}
			onConfirm={deleteAndClose}
			mutation={saveMutation}
		>
			<p>
				Êtes-vous sûr de vouloir supprimer l'écoute ?<br />
				{listening && (
					<>
						Date : {formatDate(listening.listeningDate)}
						<br />
						Artiste : <strong>{listening.artist.join(", ")}</strong> <br />
						Album : <strong>{listening.album}</strong>
					</>
				)}
			</p>
		</ConfirmDeleteModal>
	);
}
