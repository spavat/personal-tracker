import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { getCurrentOrPreviousDate } from "../../../utils";
import { listeningDetailsQuery, save } from "../api";
import ListeningForm from "../forms/ListeningsForm";
import { type MusicListeningForm, MusicListeningFormSchema, onSubmitListening } from "../forms/ListeningsForm.utils";

const defaultValues = {
	artist: [{ value: "" }],
	album: "",
	genre: "",
	duration: 0,
	listeningDate: getCurrentOrPreviousDate(),
	releaseDate: "",
};

export default function EditListeningModalForm({ listeningId, returnTo }: { listeningId: string; returnTo: string }) {
	const navigate = useNavigate();

	const queryClient = useQueryClient();

	const { data: listening } = useSuspenseQuery(listeningDetailsQuery(listeningId));

	const saveMutation = useMutation({
		mutationFn: save,
		onSuccess: () => {
			methods.reset(defaultValues);
			queryClient.invalidateQueries({ queryKey: ["music", "listenings"] });
			closeModal();
		},
	});
	const methods = useForm<MusicListeningForm>({
		resolver: zodResolver(MusicListeningFormSchema),
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: {
			...defaultValues,
			...listening,
			artist: listening.artist.map((artist: string) => ({ value: artist })),
			contextTags: (listening.contextTags ?? []).map((tag: string) => ({ value: tag })),
		},
	});

	function closeModal() {
		methods.reset();
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const onSubmit: SubmitHandler<MusicListeningForm> = (data) => {
		const parsedListening = onSubmitListening(data);
		saveMutation.mutate({
			...parsedListening,
		});
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className={"modal form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">Modifier l'écoute</h2>
					</div>
					<div className="dialog-body">
						<div className="single-panel">
							<ListeningForm />
						</div>
					</div>

					<div className="dialog-footer">
						<MutationError error={saveMutation.error} />
						<button type="button" onClick={closeModal}>
							Annuler
						</button>
						<button type="submit" className="main" disabled={saveMutation.isPending}>
							Enregistrer
						</button>
					</div>
				</Modal>
			</form>
		</FormProvider>
	);
}
