import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { deleteModel, modelDetailsQuery } from "../api";

export default function DeleteReadingModalForm({
	modelId,
	spectacleId,
	returnTo,
}: {
	modelId: string;
	spectacleId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const deleteModelMutation = useMutation({
		mutationFn: deleteModel,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["shows", "models", modelId] });
			queryClient.invalidateQueries({ queryKey: ["shows", "spectacles", spectacleId] });
			closeModal();
		},
	});
	const { data } = useSuspenseQuery(modelDetailsQuery(modelId));

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	function deleteAndClose() {
		deleteModelMutation.mutate(modelId);
	}

	return (
		<ConfirmDeleteModal
			title="Supprimer modèle"
			onClose={closeModal}
			onConfirm={deleteAndClose}
			mutation={deleteModelMutation}
		>
			<p>
				Êtes-vous sûr de vouloir supprimer le modèle?
				<br />
				Spectacle : {data.spectacle.name}
				<br />
				Nom : {data.name}
				<br />
				Rôles définis : {data.roles.length}
			</p>
		</ConfirmDeleteModal>
	);
}
