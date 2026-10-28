import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { formatDate, getDurationString } from "../../../utils";
import { deleteItem, gameDetailsQuery } from "../api";

export default function DeletePlayModalForm({
	gameId,
	playId,
	returnTo,
}: {
	gameId: string;
	playId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const saveMutation = useMutation({
		mutationFn: deleteItem,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["game", "games"] });
			queryClient.invalidateQueries({ queryKey: ["game", "game", gameId] });
			closeModal();
		},
	});

	const { data } = useSuspenseQuery(gameDetailsQuery(gameId));

	const play = data.plays.find((p: any) => p.id === playId)!;

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	function deleteAndClose() {
		saveMutation.mutate({
			gameId: gameId,
			playId: playId,
		});
	}

	return (
		<Modal className={"modal form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer partie</h2>
			</div>
			<div className="dialog-body">
				<p>
					Êtes-vous sûr de vouloir supprimer la partie suivante ?
					<br />
					Date : <strong>{formatDate(play.date)}</strong>
					<br />
					Durée : <strong>{getDurationString(play.duration ?? 0)}</strong>
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
