import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import z from "zod";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { getCurrentOrPreviousDate } from "../../../utils";
import { gamesQuery, save } from "../api";
import GameForm from "../forms/GameForm";
import { GameFormSchema, onSubmitGame } from "../forms/GameForm.utils";
import PlayForm from "../forms/PlayForm";
import { GamePlayFormSchema, onSubmitPlay } from "../forms/PlayForm.utils";

const FullSchema = z
	.object({
		game: GameFormSchema.optional(),
		play: GamePlayFormSchema,
		gameId: z.string(),
	})
	.refine(({ gameId, game }) => Boolean(gameId) || Boolean(game), {
		message: "A game is needed: gameId or a new game",
		path: ["gameId"],
	});

type Inputs = z.input<typeof FullSchema>;

export default function AddPlayModalForm({ gameId, returnTo }: { gameId?: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(gamesQuery());
	const saveMutation = useMutation({
		mutationFn: save,
		onSuccess: () => {
			methods.reset();
			queryClient.invalidateQueries({ queryKey: ["game", "games"] });
			queryClient.invalidateQueries({ queryKey: ["game", "game", gameId] });
			queryClient.invalidateQueries({ queryKey: ["game", "plays"] });
			closeModal();
		},
	});

	const methods = useForm<Inputs>({
		defaultValues: {
			play: {
				date: getCurrentOrPreviousDate(),
			},
			gameId,
		},
		resolver: zodResolver(FullSchema),
	});

	const [showAddGamePanel, setShowAddGamePanel] = useState(false);

	function addNewGame(b: boolean) {
		methods.setValue("gameId", "");
		setShowAddGamePanel(b);
	}

	function onChangeGameId() {
		setShowAddGamePanel(false);
		// the new game panel is closed: its fields must not be validated nor sent
		methods.unregister("game");
	}

	function closeModal() {
		setShowAddGamePanel(false);
		methods.reset();
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		const dataPlay = onSubmitPlay(data);
		let dataGame = null;
		if (showAddGamePanel) {
			dataGame = onSubmitGame(data);
		}
		saveMutation.mutate({
			play: {
				...dataPlay,
			},
			gameId: data.gameId,
			...(!data.gameId
				? {
						game: {
							...dataGame,
						},
					}
				: {}),
		});
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal
					className={`modal form ${showAddGamePanel ? "dialog-extralarge" : "dialog-medium"}`}
					isOpen={true}
					onClose={closeModal}
					hasCloseBtn={true}
				>
					<div className="dialog-header">
						<h2 id="dialog-title">Ajouter partie</h2>
					</div>

					<div className="dialog-body double-panel">
						<div className="form_part_1">
							<div className="panel">
								<h3>
									<label htmlFor="gameId">Jeu</label>
								</h3>
								<label>
									<select id="gameId" {...methods.register("gameId", { onChange: onChangeGameId })}>
										<option value=""></option>
										{data.map((game) => (
											<option value={game.id} key={game.id}>
												{game.name}
											</option>
										))}
									</select>
								</label>
								&nbsp;ou&nbsp;
								<button type="button" onClick={() => addNewGame(true)}>
									Créer nouveau
								</button>
								{methods.formState.errors.gameId && (
									<span className="error">Choisir un jeu ou en créer un nouveau</span>
								)}
							</div>

							<PlayForm />
						</div>
						{showAddGamePanel && (
							<div className="form_part_2">
								<h3>Nouveau jeu</h3>
								<GameForm />
							</div>
						)}
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
