import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../../components/modal";
import MutationError from "../../../../components/mutation-error";
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
		<Modal className="form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer l'évènement</h2>
			</div>
			<div className="dialog-body">
				<p>
					Êtes-vous sûr de vouloir supprimer l'évènement <strong>{EVENT_TYPE_LABELS[event.type]}</strong> du{" "}
					{formatFullDate(event.date)} ?
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
