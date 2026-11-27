import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
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
		<ConfirmDeleteModal
			title="Supprimer la série"
			onClose={closeModal}
			onConfirm={() => deleteMutation.mutate()}
			mutation={deleteMutation}
		>
			<p>
				Êtes-vous sûr de vouloir supprimer la série <strong>{series.title}</strong> ? Ses livres restent.
			</p>
		</ConfirmDeleteModal>
	);
}
