import type { GameWithOverview } from "@personal-tracker/shared/game";

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import MutationError from "../../../components/MutationError";
import { gameDetailsQuery, gamesQuery, mergeGames } from "../api";
import { STORE_LABELS } from "../stores";
import { formatPlayDuration } from "../time.utils";

const storeIdsText = (game: GameWithOverview) =>
	Object.entries(game.storeIds ?? {})
		.map(([store, id]) => `${STORE_LABELS[store as keyof typeof STORE_LABELS] ?? store} ${id}`)
		.join(", ");

/** A game picker: a filter on the name narrowing a select. */
function GamePicker({
	label,
	games,
	value,
	exclude,
	onChange,
}: {
	label: string;
	games: GameWithOverview[];
	value?: string;
	exclude?: string;
	onChange: (id: string | undefined) => void;
}) {
	const [filter, setFilter] = useState("");
	const wanted = filter.trim().toLowerCase();
	const options = games.filter(
		(game) => game.id !== exclude && (game.id === value || game.name.toLowerCase().includes(wanted)),
	);

	return (
		<div className="form-field">
			<label htmlFor={`merge-${label}`}>
				<span>{label}</span>
			</label>
			<input
				type="search"
				placeholder="Filtrer par nom…"
				aria-label={`Filtrer : ${label}`}
				value={filter}
				onChange={(e) => setFilter(e.target.value)}
			/>
			<select id={`merge-${label}`} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
				<option value="">Choisir un jeu</option>
				{options.map((game) => (
					<option key={game.id} value={game.id}>
						{game.name} ({game.playCount} partie{game.playCount > 1 ? "s" : ""})
					</option>
				))}
			</select>
		</div>
	);
}

/**
 * Merges two games into one: the main one keeps all its data and gets the secondary's plays, store ids it lacks
 * (so the store sync doesn't re-create the secondary) and missing pictures; the secondary is deleted.
 */
export default function Merge({ keepId, removeId }: { keepId?: string; removeId?: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: games } = useSuspenseQuery(gamesQuery());
	const keep = games.find((game) => game.id === keepId);
	const remove = games.find((game) => game.id === removeId);
	// plays of both, for the same-day warning
	const { data: keepDetails } = useQuery({ ...gameDetailsQuery(keepId ?? ""), enabled: Boolean(keep) });
	const { data: removeDetails } = useQuery({ ...gameDetailsQuery(removeId ?? ""), enabled: Boolean(remove) });

	const mergeMutation = useMutation({
		mutationFn: () => mergeGames({ keepId: keepId!, removeId: removeId! }),
		onSuccess: ({ id }) => {
			// the secondary is deleted: refetching it would only retry a 404
			queryClient.removeQueries({ queryKey: gameDetailsQuery(removeId!).queryKey });
			queryClient.invalidateQueries({ queryKey: ["game"] });
			navigate({ to: "/game/details/$gameId", params: { gameId: id } });
		},
	});

	function select(ids: { keepId?: string; removeId?: string }) {
		navigate({ to: "/game/merge", search: ids, replace: true, resetScroll: false });
	}

	const movedStores = remove
		? Object.entries(remove.storeIds ?? {}).filter(
				([store]) => !keep?.storeIds?.[store as keyof typeof keep.storeIds],
			)
		: [];
	const sameDays =
		keepDetails && removeDetails
			? removeDetails.plays.filter((play) =>
					keepDetails.plays.some((other) => other.date === play.date && other.origin === play.origin),
				).length
			: 0;

	return (
		<div className="merge">
			<p className="info">
				Le jeu principal garde toutes ses informations et reçoit les parties du jeu secondaire, ses magasins
				absents du principal et ses images manquantes. Le jeu secondaire est ensuite supprimé.
			</p>
			<div className="form panel">
				<div className="form-grid">
					<GamePicker
						label="Jeu principal"
						games={games}
						value={keepId}
						exclude={removeId}
						onChange={(id) => select({ keepId: id, removeId })}
					/>
					<GamePicker
						label="Jeu secondaire"
						games={games}
						value={removeId}
						exclude={keepId}
						onChange={(id) => select({ keepId, removeId: id })}
					/>
				</div>
				<button
					type="button"
					disabled={!keep && !remove}
					onClick={() => select({ keepId: removeId, removeId: keepId })}
				>
					<i className="fa-solid fa-right-left"></i> Inverser
				</button>
			</div>

			{keep && remove && (
				<div className="form panel">
					<h3>Résultat</h3>
					<ul>
						<li>
							<b>{keep.name}</b> garde son nom, son développeur ({keep.developper}), son éditeur (
							{keep.editor}), son statut, son commentaire et ses liens.
						</li>
						<li>
							Il reçoit les {remove.playCount} partie{remove.playCount > 1 ? "s" : ""} de{" "}
							<b>{remove.name}</b> ({formatPlayDuration(remove.totalDuration) || "0min"}).
						</li>
						{movedStores.length > 0 && (
							<li>
								Magasins ajoutés :{" "}
								{movedStores
									.map(([store, id]) => `${STORE_LABELS[store as keyof typeof STORE_LABELS]} ${id}`)
									.join(", ")}
								.
							</li>
						)}
						{storeIdsText(keep) && <li>Magasins gardés : {storeIdsText(keep)}.</li>}
						{(!keep.capsule && remove.capsule) || (!keep.header && remove.header) ? (
							<li>Ses images manquantes sont prises du jeu secondaire.</li>
						) : null}
						<li>
							<b>{remove.name}</b> est supprimé.
						</li>
					</ul>
					{sameDays > 0 && (
						<p className="integration-error">
							{sameDays} partie{sameDays > 1 ? "s" : ""} du jeu secondaire tombe{sameDays > 1 ? "nt" : ""}{" "}
							le même jour et sur la même origine qu'une partie du principal : vérifier qu'il ne s'agit
							pas du même temps compté deux fois.
						</p>
					)}
					<MutationError error={mergeMutation.error} />
					<div className="form-footer">
						<button
							type="button"
							className="main"
							disabled={mergeMutation.isPending}
							onClick={() => mergeMutation.mutate()}
						>
							<i className="fa-solid fa-code-merge"></i> Fusionner
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
