import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { formatDate } from "../../../utils";
import { activityDetailsQuery, deleteActivity } from "../api";

export default function DeleteActivityModalForm({ activityId, returnTo }: { activityId: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: activity } = useSuspenseQuery(activityDetailsQuery(activityId));

	const deleteMutation = useMutation({
		mutationFn: deleteActivity,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["sport", "activities"] });
			// the activity's own page no longer exists
			navigate({
				to: returnTo.startsWith(`/sport/${activityId}`) ? "/sport/list" : returnTo,
				replace: true,
				resetScroll: false,
			});
			queryClient.removeQueries({ queryKey: ["sport", "activity", activityId] });
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
		deleteMutation.mutate({ id: activityId });
	}

	return (
		<ConfirmDeleteModal
			title="Supprimer activité"
			onClose={closeModal}
			onConfirm={confirmDelete}
			mutation={deleteMutation}
		>
			<p>
				Êtes-vous sûr de vouloir supprimer l'activité <strong>{activity.name}</strong> du{" "}
				{formatDate(activity.date)} ?
			</p>
		</ConfirmDeleteModal>
	);
}
