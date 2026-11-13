import type { GameStore } from "@personal-tracker/shared/game";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import { getDurationString } from "../../../utils";
import { confirmImport, importPreviewQuery } from "../api";
import { GAME_ORIGINS } from "../origins";
import { STORE_LABELS } from "../stores";

const duration = (minutes: number) => getDurationString(minutes) || "0min";

export default function ImportPreviewModal({ store, returnTo }: { store: GameStore; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: rows } = useSuspenseQuery(importPreviewQuery(store));
	const importMutation = useMutation({
		mutationFn: () => confirmImport(store),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["game"] });
			closeModal();
		},
	});

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	const created = rows.filter((row) => !row.game).length;
	const catchUp = rows.reduce((sum, row) => sum + row.catchUp, 0);

	return (
		<Modal className="modal form dialog-large" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Import initial {STORE_LABELS[store]}</h2>
			</div>
			<div className="dialog-body">
				<p>
					{rows.length} temps de jeu, {created} jeu{created > 1 ? "x" : ""} à créer, {duration(catchUp)} de
					rattrapage. Le rattrapage est le temps du magasin moins celui déjà enregistré sur le jeu ; refaire
					l'import le remplace.
				</p>
				<table className="list alternate responsive">
					<thead>
						<tr>
							<th>Jeu du magasin</th>
							<th>Origine</th>
							<th>Jeu</th>
							<th>Magasin</th>
							<th>Déjà enregistré</th>
							<th>Rattrapage</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={`${row.storeGameId}-${row.origin}`}>
								<td data-label="Jeu du magasin">{row.name}</td>
								<td data-label="Origine">{GAME_ORIGINS[row.origin].label}</td>
								<td data-label="Jeu">{row.game ? row.game.name : <i>nouveau</i>}</td>
								<td data-label="Magasin">{duration(row.storeMinutes)}</td>
								<td data-label="Déjà enregistré">
									{row.recordedMinutes > 0 ? duration(row.recordedMinutes) : ""}
								</td>
								<td data-label="Rattrapage">
									<b>{duration(row.catchUp)}</b>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="dialog-footer">
				<MutationError error={importMutation.error} />
				<button type="button" onClick={closeModal}>
					Annuler
				</button>
				<button
					type="button"
					className="main"
					disabled={importMutation.isPending}
					onClick={() => importMutation.mutate()}
				>
					{importMutation.isPending ? "Import en cours…" : "Confirmer"}
				</button>
			</div>
		</Modal>
	);
}
