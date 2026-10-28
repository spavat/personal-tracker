import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { formatDate } from "../../../utils.tsx";
import { deleteReading, mangaDetailsQuery } from "../api.ts";
import { getMangaPrefixName } from "../utils.ts";

export default function DeleteReadingModalForm({
	mangaId,
	readingId,
	returnTo,
}: {
	mangaId: string;
	readingId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const deleteReadingMutation = useMutation({
		mutationFn: deleteReading,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reading", "manga", mangaId] });
			closeModal();
		},
	});
	const { data } = useSuspenseQuery(mangaDetailsQuery(mangaId));

	const reading = data.readings.find((r: any) => r.id === readingId)!;

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	function deleteAndClose() {
		deleteReadingMutation.mutate({
			id: mangaId,
			readingId,
		});
	}

	return (
		<Modal className={"form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer lecture</h2>
			</div>
			<div className="dialog-body">
				<p>
					Êtes-vous sûr de vouloir supprimer la lecture ?<br />
					Nom :{" "}
					<strong>
						{getMangaPrefixName(reading)}
						{reading.name}
					</strong>
					<br />
					Date : {formatDate(reading.date)}
				</p>
				<MutationError error={deleteReadingMutation.error} />
			</div>

			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Annuler
				</button>
				<button
					type="submit"
					className="main"
					onClick={deleteAndClose}
					disabled={deleteReadingMutation.isPending}
				>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
