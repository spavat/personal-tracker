import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../../components/ConfirmDeleteModal";
import { formatFullDate } from "../../../../utils";
import { deleteEvent, objectDetailsQuery } from "../../api";
import { EVENT_TYPE_LABELS } from "../../labels";

export default function DeleteEventModalForm({
	objectId,
	eventId,
	returnTo,
}: {
	objectId: string;
	eventId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: object } = useSuspenseQuery(objectDetailsQuery(objectId));
	const event = object.events.find((e) => e.id === eventId)!;

	const deleteMutation = useMutation({
		mutationFn: deleteEvent,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lifespan", "objects"] });
			closeModal();
		},
	});

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	function confirmDelete() {
		deleteMutation.mutate({ objectId, eventId });
	}

	return (
		<ConfirmDeleteModal
			title="Supprimer l'évènement"
			onClose={closeModal}
			onConfirm={confirmDelete}
			mutation={deleteMutation}
		>
			<p>
				Êtes-vous sûr de vouloir supprimer l'évènement <strong>{EVENT_TYPE_LABELS[event.type]}</strong> du{" "}
				{formatFullDate(event.date)} ?
			</p>
		</ConfirmDeleteModal>
	);
}
