import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { formatDate } from "../../../utils";
import { deleteItem, gameDetailsQuery } from "../api";
import PlayDate from "../components/PlayDate";
import { formatPlayDuration } from "../time.utils";

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
		<ConfirmDeleteModal
			title="Supprimer partie"
			onClose={closeModal}
			onConfirm={deleteAndClose}
			mutation={saveMutation}
		>
			<p>
				Êtes-vous sûr de vouloir supprimer la partie suivante ?
				<br />
				Date : <strong>{play.catchUp ? <PlayDate {...play} /> : formatDate(play.date)}</strong>
				<br />
				Durée : <strong>{formatPlayDuration(play.duration ?? 0)}</strong>
			</p>
		</ConfirmDeleteModal>
	);
}
