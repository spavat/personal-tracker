import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
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
		<Modal className={"form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer modèle</h2>
			</div>
			<div className="dialog-body">
				<p>
					Êtes-vous sûr de vouloir supprimer le modèle?
					<br />
					Spectacle : {data.spectacle.name}
					<br />
					Nom : {data.name}
					<br />
					Rôles définis : {data.roles.length}
				</p>
				<MutationError error={deleteModelMutation.error} />
			</div>

			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Annuler
				</button>
				<button
					type="submit"
					className="main"
					onClick={deleteAndClose}
					disabled={deleteModelMutation.isPending}
				>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
