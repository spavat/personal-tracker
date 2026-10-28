import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { deleteItem, programDetailsQuery } from "../api";

export default function DeleteEpisodeModalForm({
	programId,
	episodeId,
	returnTo,
}: {
	programId: string;
	episodeId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const saveMutation = useMutation({
		mutationFn: deleteItem,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["programs"] });
			queryClient.invalidateQueries({ queryKey: ["program", programId] });
			closeModal();
		},
	});

	const { data } = useSuspenseQuery(programDetailsQuery(programId));

	function deleteAndClose() {
		saveMutation.mutate({
			programId: programId,
			episodeId: episodeId,
		});
	}

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const episode = data.episodes.find((ep) => ep.id === episodeId)!;

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
