import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
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
		<Modal className={"form modal dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer épisode</h2>
			</div>

			<div className="dialog-body">
				<p>
					Êtes-vous sûr de vouloir supprimer l'épisode
					<br />
					<strong>{episode.name}</strong> ?
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
