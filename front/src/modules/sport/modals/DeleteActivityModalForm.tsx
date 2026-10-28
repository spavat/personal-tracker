import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
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
		<Modal className="form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer activité</h2>
			</div>
			<div className="dialog-body">
				<p>
					Êtes-vous sûr de vouloir supprimer l'activité <strong>{activity.name}</strong> du{" "}
					{formatDate(activity.date)} ?
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
