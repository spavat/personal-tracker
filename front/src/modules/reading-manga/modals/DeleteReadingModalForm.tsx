import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
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
		<ConfirmDeleteModal
			title="Supprimer lecture"
			onClose={closeModal}
			onConfirm={deleteAndClose}
			mutation={deleteReadingMutation}
		>
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
		</ConfirmDeleteModal>
	);
}
