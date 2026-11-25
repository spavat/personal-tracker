import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import { programDetailsQuery, save } from "../api";
import { toLines } from "../episode-lines";
import { toCreditInputs } from "../forms/CreditRows";
import EpisodeForm from "../forms/EpisodeForm";
import { type EpisodeInputs, onSubmitEpisode } from "../forms/EpisodeForm.utils";

interface Inputs extends EpisodeInputs {
	programId: string;
}

// Edits a line: its episode's fields (shared by the episode's views) and its view's
export default function EditEpisodeModalForm({
	programId,
	viewId,
	returnTo,
}: {
	programId: string;
	viewId: string;
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

	const lines = toLines(data.episodes);
	const episode = lines.find((line) => line.id === viewId)!;
	const viewCount = lines.filter((line) => line.episodeId === episode.episodeId).length;

	const methods = useForm<Inputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: {
			programId,
			episode: {
				...episode,
				tags: episode.tags?.map((t) => ({ value: t })) ?? [],
				contextTags: episode.contextTags?.map((t) => ({ value: t })) ?? [],
				ignoredTags: episode.ignoredTags?.map((t) => ({ value: t })) ?? [],
				credits: toCreditInputs(episode.credits),
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

		saveMutation.mutate({
			programId: data.programId,
			episode: dataEpisode,
		});
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className={"form modal dialog-large"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">Modifier épisode</h2>
					</div>

					<div className="dialog-body single-panel">
						{viewCount > 1 && (
							<p>
								<em>
									Épisode écouté {viewCount} fois : son nom, sa durée, son lien et ses tags changent
									pour chaque écoute.
								</em>
							</p>
						)}
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
