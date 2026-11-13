import type { GameStore, GameSyncStatus } from "@personal-tracker/shared/game";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import MutationError from "../../components/MutationError";
import { formatFullDate, getDurationString } from "../../utils";
import { replaySync, runSync, syncStatusQuery, type SyncRunResult } from "./api";
import { STORE_LABELS } from "./stores";

// how a store gets configured, shown while it isn't
const SETUP_HINTS: Record<GameStore, string> = {
	steam: "Renseigner STEAM_API_KEY et STEAM_ID (SteamID64) dans server/.env, puis redémarrer le serveur.",
	gog: "Renseigner GOG_USERNAME dans server/.env (profil GOG public), puis redémarrer le serveur.",
	epic: "Se connecter avec « legendary auth », puis lancer « npx tsx scripts/seed-epic-token.ts » depuis server/.",
};

/** A stored instant (UTC) in local date and time. */
export function formatInstant(instant: string) {
	return Temporal.Instant.from(instant)
		.toZonedDateTimeISO(Temporal.Now.timeZoneId())
		.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function runMessage(result: SyncRunResult) {
	if (result.status === "error") return `Échec : ${result.error}`;
	if (result.status === "baseline")
		return "Point de départ enregistré : le temps de jeu sera compté à partir de maintenant";
	if (result.plays === 0) return "Aucun temps de jeu depuis la dernière récupération";
	return `${result.plays} partie${result.plays > 1 ? "s" : ""} mise${result.plays > 1 ? "s" : ""} à jour (${getDurationString(result.minutes)})`;
}

function StorePanel({ status }: { status: GameSyncStatus["stores"][number] }) {
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries({ queryKey: ["game"] });
	const runMutation = useMutation({ mutationFn: () => runSync(status.store), onSuccess: invalidate });
	const replayMutation = useMutation({ mutationFn: replaySync, onSuccess: invalidate });

	const last = status.snapshots[0];
	const runResult = runMutation.data?.[0];

	return (
		<div className="panel integration">
			<h3>
				{STORE_LABELS[status.store]}{" "}
				{status.configured ? (
					<span className="integration-state ok">Configuré</span>
				) : (
					<span className="integration-state off">Non configuré</span>
				)}
			</h3>
			{!status.configured && <p className="info">{SETUP_HINTS[status.store]}</p>}
			<p>Jeux liés : {status.linkedGames}</p>
			<p>
				Dernière récupération :{" "}
				{last ? (
					<>
						{formatInstant(last.fetchedAt)} ({last.kind === "import" ? "import" : "synchronisation"}){" "}
						{last.status === "ok" ? (
							<i className="fa-solid fa-check integration-ok" title="Réussie"></i>
						) : (
							<i className="fa-solid fa-circle-exclamation sync-error" title="Échec"></i>
						)}
					</>
				) : (
					"jamais"
				)}
			</p>
			{last?.status === "error" && <p className="integration-error">{last.error}</p>}
			{status.tokenExpiresAt && (
				<p>Jeton Epic valable jusqu'au {formatFullDate(status.tokenExpiresAt.slice(0, 10))}</p>
			)}

			{runResult && (
				<p className={runResult.status === "error" ? "integration-error" : ""}>{runMessage(runResult)}</p>
			)}
			<MutationError error={runMutation.error} />

			<div className="form-footer">
				<button
					type="button"
					disabled={!status.configured}
					onClick={() =>
						navigate({
							to: "/game/integrations/import/$store",
							params: { store: status.store },
							search: { returnTo: location.pathname },
							replace: true,
							resetScroll: false,
						})
					}
				>
					<i className="fa-solid fa-file-import"></i> Import initial
				</button>
				<button
					type="button"
					className="main"
					disabled={!status.configured || runMutation.isPending}
					onClick={() => runMutation.mutate()}
				>
					{runMutation.isPending ? "Synchronisation…" : "Lancer maintenant"}
				</button>
			</div>

			{status.snapshots.length > 0 && (
				<details>
					<summary>Récupérations des 30 derniers jours ({status.snapshots.length})</summary>
					{replayMutation.data && (
						<p>
							Jour rejoué : {replayMutation.data.plays} partie{replayMutation.data.plays > 1 ? "s" : ""} (
							{getDurationString(replayMutation.data.minutes) || "0min"})
						</p>
					)}
					<MutationError error={replayMutation.error} />
					<table className="list alternate responsive">
						<thead>
							<tr>
								<th>Date</th>
								<th>Jour de jeu</th>
								<th>Type</th>
								<th>Statut</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{status.snapshots.map((snapshot) => (
								<tr key={snapshot.id}>
									<td data-label="Date">{formatInstant(snapshot.fetchedAt)}</td>
									<td data-label="Jour de jeu">{formatFullDate(snapshot.day)}</td>
									<td data-label="Type">
										{snapshot.kind === "import" ? "Import" : "Synchronisation"}
									</td>
									<td data-label="Statut">
										{snapshot.status === "ok" ? (
											"Réussie"
										) : (
											<span className="integration-error">{snapshot.error}</span>
										)}
									</td>
									<td data-label="Actions">
										{snapshot.replayable && (
											<button
												type="button"
												title="Recalcule les parties de ce jour à partir des récupérations gardées"
												disabled={replayMutation.isPending}
												onClick={() =>
													replayMutation.mutate({ store: status.store, day: snapshot.day })
												}
											>
												<i className="fa-solid fa-rotate"></i> Rejouer
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</details>
			)}
		</div>
	);
}

function DuplicatesPanel({ duplicates }: { duplicates: GameSyncStatus["duplicates"] }) {
	const navigate = useNavigate();
	const location = useLocation();
	if (duplicates.length === 0) return null;

	return (
		<div className="panel integration">
			<h3>Doublons possibles</h3>
			<p className="info">
				Jeux au nom identique : garder l'un d'eux y fusionne l'autre (parties, magasins, images).
			</p>
			{duplicates.map((group) => (
				<ul key={group.map((game) => game.id).join("-")} className="integration-duplicates">
					{group.map((game, index) => {
						const other = group[index === 0 ? 1 : 0];
						return (
							<li key={game.id}>
								<b>{game.name}</b>{" "}
								<span className="smalltext">
									{Object.entries(game.storeIds ?? {})
										.map(([store, id]) => `${STORE_LABELS[store as GameStore] ?? store} ${id}`)
										.join(", ") || "aucun magasin"}
								</span>{" "}
								<button
									type="button"
									onClick={() =>
										navigate({
											to: "/game/integrations/merge/$keepId/$removeId",
											params: { keepId: game.id, removeId: other.id },
											search: { returnTo: location.pathname },
											replace: true,
											resetScroll: false,
										})
									}
								>
									<i className="fa-solid fa-code-merge"></i> Garder celui-ci
								</button>
							</li>
						);
					})}
				</ul>
			))}
		</div>
	);
}

export default function Integrations() {
	const { data } = useSuspenseQuery(syncStatusQuery());

	return (
		<>
			<p className="info">
				Le temps de jeu des magasins est récupéré chaque jour à 4h. L'import initial ajoute le temps déjà joué
				(« Rattrapage ») ; la synchronisation ajoute ensuite le temps joué chaque jour.
			</p>
			<div className="integrations">
				{data.stores.map((store) => (
					<StorePanel key={store.store} status={store} />
				))}
			</div>
			<DuplicatesPanel duplicates={data.duplicates} />
			<Outlet />
		</>
	);
}
