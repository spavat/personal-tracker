import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import { deleteSeries, seriesDetailsQuery } from "../api";

// The books stay: only the series and its order go
export default function DeleteSeriesModalForm({ seriesId, returnTo }: { seriesId: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: series } = useSuspenseQuery(seriesDetailsQuery(seriesId));

	const deleteMutation = useMutation({
		mutationFn: () => deleteSeries(seriesId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reading"] });
			navigate({ to: "/reading-book/series", replace: true });
		},
	});

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	return (
		<Modal className={"modal form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer la série</h2>
			</div>
			<div className="dialog-body">
				<p>
					Êtes-vous sûr de vouloir supprimer la série <strong>{series.title}</strong> ? Ses livres restent.
				</p>
				<MutationError error={deleteMutation.error} />
			</div>
			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Annuler
				</button>
				<button
					type="submit"
					className="main"
					onClick={() => deleteMutation.mutate()}
					disabled={deleteMutation.isPending}
				>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
