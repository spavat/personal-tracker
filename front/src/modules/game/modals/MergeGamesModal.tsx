import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import { gameDetailsQuery, mergeGames } from "../api";

export default function MergeGamesModal({
	keepId,
	removeId,
	returnTo,
}: {
	keepId: string;
	removeId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: keep } = useSuspenseQuery(gameDetailsQuery(keepId));
	const { data: remove } = useSuspenseQuery(gameDetailsQuery(removeId));
	const mergeMutation = useMutation({
		mutationFn: () => mergeGames({ keepId, removeId }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["game"] });
			closeModal();
		},
	});

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	return (
		<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Fusionner deux jeux</h2>
			</div>
			<div className="dialog-body">
				<p>
					Les {remove.plays.length} partie{remove.plays.length > 1 ? "s" : ""}, les magasins et les images
					manquantes de <b>{remove.name}</b> passent sur <b>{keep.name}</b> ({keep.plays.length} partie
					{keep.plays.length > 1 ? "s" : ""}), puis <b>{remove.name}</b> est supprimé.
				</p>
			</div>
			<div className="dialog-footer">
				<MutationError error={mergeMutation.error} />
				<button type="button" onClick={closeModal}>
					Annuler
				</button>
				<button
					type="button"
					className="main"
					disabled={mergeMutation.isPending}
					onClick={() => mergeMutation.mutate()}
				>
					Fusionner
				</button>
			</div>
		</Modal>
	);
}
