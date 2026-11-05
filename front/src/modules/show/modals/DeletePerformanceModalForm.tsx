import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
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
		<Modal className="form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer représentation</h2>
			</div>
			<div className="dialog-body">
				<p>
					Êtes-vous sûr de vouloir supprimer la représentation <strong>{performance.spectacle.name}</strong>{" "}
					du {date} à {time} ?
				</p>
				<MutationError error={deleteMutation.error} />
			</div>
			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Annuler
				</button>
				<button type="button" className="main" onClick={confirmDelete} disabled={deleteMutation.isPending}>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
