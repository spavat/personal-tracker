import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { deletePlace, placeDetailsQuery } from "../api";

export default function DeletePlaceModalForm({ placeId, returnTo }: { placeId: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const deletePlaceMutation = useMutation({
		mutationFn: deletePlace,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shows", "places"] });
			closeModal();
		},
	});
	const { data } = useSuspenseQuery(placeDetailsQuery(placeId, false));

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	function deleteAndClose() {
		deletePlaceMutation.mutate(placeId);
	}

	const nbSpectacles = data.stats.nbSpectacles;
	const nbPerformances = data.stats.nbPerformances;
	const canBeDeleted = nbSpectacles === 0 && nbPerformances === 0;

	return (
		<Modal className={"form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer lieu</h2>
			</div>
			<div className="dialog-body">
				{canBeDeleted ? (
					<p>
						Êtes-vous sûr de vouloir supprimer le lieu ?
						<br />
						Nom : {data.name}
						<br />
					</p>
				) : (
					<p>
						Impossible de supprimer le lieux <strong>{data.name}</strong>
						<br />
						Spectacles : {nbSpectacles}
						<br />
						Représentations : {nbPerformances}
					</p>
				)}
				<MutationError error={deletePlaceMutation.error} />
			</div>

			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Annuler
				</button>
				<button
					type="submit"
					className="main"
					onClick={deleteAndClose}
					disabled={!canBeDeleted || deletePlaceMutation.isPending}
				>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
