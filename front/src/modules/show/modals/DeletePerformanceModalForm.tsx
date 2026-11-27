import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { deletePerformance, performanceDetailsQuery } from "../api";
import { formatShowDate } from "../utils";

export default function DeletePerformanceModalForm({
	performanceId,
	returnTo,
}: {
	performanceId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: performance } = useSuspenseQuery(performanceDetailsQuery(performanceId));

	const deleteMutation = useMutation({
		mutationFn: deletePerformance,
		onSuccess: async () => {
			// the performance's own page no longer exists
			await navigate({
				to: "/shows/spectacles/$spectacleId",
				params: { spectacleId: String(performance.spectacle.id) },
				replace: true,
			});
			queryClient.removeQueries({ queryKey: ["shows", "performances", performanceId] });
			// the performance is listed in its spectacle, place, artists, history...
			queryClient.invalidateQueries({ queryKey: ["shows"] });
		},
	});

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	function confirmDelete() {
		deleteMutation.mutate(performanceId);
	}

	const [date, time] = formatShowDate(performance.date).split(" ");

	return (
		<ConfirmDeleteModal
			title="Supprimer représentation"
			onClose={closeModal}
			onConfirm={confirmDelete}
			mutation={deleteMutation}
		>
			<p>
				Êtes-vous sûr de vouloir supprimer la représentation <strong>{performance.spectacle.name}</strong> du{" "}
				{date} à {time} ?
			</p>
		</ConfirmDeleteModal>
	);
}
