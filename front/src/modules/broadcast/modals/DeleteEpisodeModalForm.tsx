import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { deleteLine, programDetailsQuery } from "../api";
import { toLines } from "../episode-lines";

// Deletes a line: its view (the episode goes too when it was its last view)
export default function DeleteEpisodeModalForm({
	programId,
	viewId,
	returnTo,
}: {
	programId: string;
	viewId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const saveMutation = useMutation({
		mutationFn: deleteLine,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["programs"] });
			queryClient.invalidateQueries({ queryKey: ["program", programId] });
			closeModal();
		},
	});

	const { data } = useSuspenseQuery(programDetailsQuery(programId));

	function deleteAndClose() {
		saveMutation.mutate({ programId, episodeId: episode.episodeId, viewId });
	}

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const episode = toLines(data.episodes).find((line) => line.id === viewId)!;

	return (
		<ConfirmDeleteModal
			title="Supprimer épisode"
			onClose={closeModal}
			onConfirm={deleteAndClose}
			mutation={saveMutation}
		>
			<p>
				Êtes-vous sûr de vouloir supprimer l'épisode
				<br />
				<strong>{episode.name}</strong> ?
			</p>
		</ConfirmDeleteModal>
	);
}
