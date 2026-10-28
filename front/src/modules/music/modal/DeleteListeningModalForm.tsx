import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
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
		<Modal className={"modal form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer une écoute</h2>
			</div>
			<div className="dialog-body">
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
				<MutationError error={saveMutation.error} />
			</div>

			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Annuler
				</button>
				<button type="submit" className="main" onClick={deleteAndClose} disabled={saveMutation.isPending}>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
