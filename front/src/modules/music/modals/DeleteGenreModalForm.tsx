import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { deleteGenre, genresQuery } from "../api";

export default function DeleteGenreModalForm({ id, returnTo }: { id: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: musicGenres } = useSuspenseQuery(genresQuery());
	const musicGenre = musicGenres.find((g) => g.id === id)!;

	const deleteMutation = useMutation({
		mutationFn: deleteGenre,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["music", "genres"] });
			closeModal();
		},
	});

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	function confirmDelete() {
		deleteMutation.mutate({ id });
	}

	return (
		<ConfirmDeleteModal
			title="Supprimer le genre principal"
			onClose={closeModal}
			onConfirm={confirmDelete}
			mutation={deleteMutation}
		>
			<p>
				Êtes-vous sûr de vouloir supprimer le genre principal <strong>{musicGenre.name}</strong> ?
			</p>
		</ConfirmDeleteModal>
	);
}
