import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { programDetailsQuery, save } from "../api";
import EpisodeForm from "../forms/EpisodeForm";
import { type EpisodeInputs, onSubmitEpisode } from "../forms/EpisodeForm.utils";

interface Inputs extends EpisodeInputs {
	programId: string;
}

export default function EditEpisodeModalForm({
	programId,
	episodeId,
	returnTo,
}: {
	programId: string;
	episodeId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(programDetailsQuery(programId));

	const saveMutation = useMutation({
		mutationFn: save,
		onSuccess: () => {
			methods.reset();
			queryClient.invalidateQueries({ queryKey: ["programs"] });
			queryClient.invalidateQueries({ queryKey: ["program", programId] });
			closeModal();
		},
	});

	const episode = data.episodes.find((ep) => ep.id === episodeId)!;

	const methods = useForm<Inputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: {
			programId,
			episode: {
				...episode,
				tags: episode.tags?.map((t) => ({ value: t })) ?? [],
				contextTags: episode.contextTags?.map((t) => ({ value: t })) ?? [],
			} as any,
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

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		const dataEpisode = onSubmitEpisode(data);

		console.log("sauvegarde episode", dataEpisode);
		saveMutation.mutate({
			programId: data.programId,
			episode: dataEpisode,
		});
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className={"form modal dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">Modifier épisode</h2>
					</div>

					<div className="dialog-body single-panel">
						<EpisodeForm />
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
