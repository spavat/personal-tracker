import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import z from "zod";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { gameDetailsQuery, save } from "../api";
import GameForm from "../forms/GameForm";
import { GameFormSchema, onSubmitGame, type GameInputs } from "../forms/GameForm.utils";

interface Inputs extends GameInputs {}

export default function GameModalForm({ gameId, returnTo }: { gameId?: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const data = useOptionalSuspenseQuery(gameId ? gameDetailsQuery(gameId) : undefined);
	const saveMutation = useMutation({
		mutationFn: save,
		onSuccess: () => {
			methods.reset();
			queryClient.invalidateQueries({ queryKey: ["game", "games"] });
			queryClient.invalidateQueries({ queryKey: ["game", "game", gameId] });
			closeModal();
		},
	});

	let defaultValues: Inputs | null = null;
	if (data?.plays) {
		const { plays, links, ...props } = data;
		defaultValues = {
			game: {
				...props,
				links: links ? links.map(({ name, link }) => ({ name, link })) : [],
			},
		};
	}

	const methods = useForm<Inputs>({
		resolver: zodResolver(z.object({ game: GameFormSchema.optional() })),
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: defaultValues as any,
	});

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		const dataGame = onSubmitGame(data);
		saveMutation.mutate({ game: dataGame });
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">Modifier le jeu</h2>
					</div>

					<div className="dialog-body">
						<GameForm />
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
