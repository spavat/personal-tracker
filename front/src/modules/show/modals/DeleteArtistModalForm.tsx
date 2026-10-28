import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { artistDetailsQuery, deleteArtist } from "../api";

export default function DeleteArtistModalForm({ artistId, returnTo }: { artistId: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const deleteArtistMutation = useMutation({
		mutationFn: deleteArtist,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shows", "artists"] });
			closeModal();
		},
	});
	const { data } = useSuspenseQuery(artistDetailsQuery(artistId, false));

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	function deleteAndClose() {
		deleteArtistMutation.mutate(artistId);
	}

	const nbSpectacles = data.stats.nbSpectacles;
	const nbPerformances = data.stats.nbPerformances;
	const canBeDeleted = nbSpectacles === 0 && nbPerformances === 0;

	return (
		<Modal className={"form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer artiste</h2>
			</div>
			<div className="dialog-body">
				{canBeDeleted ? (
					<p>
						Êtes-vous sûr de vouloir supprimer l'artiste?
						<br />
						Nom : {data.name}
						<br />
					</p>
				) : (
					<p>
						Impossible de supprimer l'artiste <strong>{data.name}</strong>
						<br />
						Spectacles : {nbSpectacles}
						<br />
						Représentations : {nbPerformances}
					</p>
				)}
				<MutationError error={deleteArtistMutation.error} />
			</div>

			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Annuler
				</button>
				<button
					type="submit"
					className="main"
					onClick={deleteAndClose}
					disabled={!canBeDeleted || deleteArtistMutation.isPending}
				>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
