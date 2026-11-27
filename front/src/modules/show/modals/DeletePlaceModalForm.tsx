import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
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
		<ConfirmDeleteModal
			title="Supprimer lieu"
			onClose={closeModal}
			onConfirm={deleteAndClose}
			mutation={deletePlaceMutation}
			canDelete={canBeDeleted}
		>
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
		</ConfirmDeleteModal>
	);
}
