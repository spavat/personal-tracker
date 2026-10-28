import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { gameDetailsQuery, save } from "../api";
import PlayForm from "../forms/PlayForm";
import { type PlayInputs, onSubmitPlay } from "../forms/PlayForm.utils";

interface Inputs extends PlayInputs {
	gameId: string;
}

export default function EditPlayModalForm({
	gameId,
	playId,
	returnTo,
}: {
	gameId: string;
	playId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();

	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(gameDetailsQuery(gameId));
	const saveMutation = useMutation({
		mutationFn: save,
		onSuccess: () => {
			methods.reset();
			queryClient.invalidateQueries({ queryKey: ["game", "games"] });
			queryClient.invalidateQueries({ queryKey: ["game", "game", gameId] });
			closeModal();
		},
	});

	const play = data.plays.find((p: any) => p.id === playId)!;

	const methods = useForm<Inputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: {
			gameId: gameId ?? "",
			play: {
				...(play as any),
			},
		},
	});

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		const dataPlay = onSubmitPlay(data);

		saveMutation.mutate({
			gameId: data.gameId,
			play: dataPlay,
		});
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className={"modal form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">Modifier la partie</h2>
					</div>
					<div className="dialog-body">
						<PlayForm />
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
