import { useMutation, useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import MutationError from "../../../components/MutationError";
import {
	bankConnectionsQuery,
	banksTreeQuery,
	deleteBankConnection,
	renewBankConnection,
	syncBanks,
	updateBankConnectionAccount,
} from "../api";
import { connectionBadge } from "./banking-status";

const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString("fr-FR") : "jamais");

export default function BankConnections() {
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();
	const [{ data: connections }, { data: banks }] = useSuspenseQueries({
		queries: [bankConnectionsQuery(), banksTreeQuery()],
	});

	const invalidate = () => queryClient.invalidateQueries({ queryKey: ["money", "banking"] });
	const syncMutation = useMutation({ mutationFn: syncBanks, onSuccess: invalidate });
	const accountMutation = useMutation({ mutationFn: updateBankConnectionAccount, onSuccess: invalidate });
	const deleteMutation = useMutation({ mutationFn: deleteBankConnection, onSuccess: invalidate });
	const renewMutation = useMutation({
		mutationFn: renewBankConnection,
		onSuccess: ({ url }) => {
			window.location.href = url;
		},
	});

	function remove(connection: Money.BankConnection) {
		if (window.confirm(`Supprimer la connexion ${connection.aspspName} ?`)) {
			deleteMutation.mutate(connection.id);
		}
	}

	return (
		<>
			<h2>
				Synchronisation bancaire
				<p className="banking-actions">
					<button
						type="button"
						onClick={() =>
							navigate({ to: "/money/banking/connections/add", search: { returnTo: location.pathname } })
						}
					>
						<i className="fa-solid fa-plus"></i> Connecter une banque
					</button>
					<button
						type="button"
						onClick={() => syncMutation.mutate()}
						disabled={syncMutation.isPending || connections.length === 0}
					>
						<i className={`fa-solid fa-rotate ${syncMutation.isPending ? "fa-spin" : ""}`}></i> Synchroniser
					</button>
					{syncMutation.data && <span>{syncMutation.data.imported} opération(s) importée(s)</span>}
				</p>
			</h2>

			<MutationError
				error={syncMutation.error ?? renewMutation.error ?? deleteMutation.error ?? accountMutation.error}
			/>

			{connections.length === 0 && <p>Aucune banque connectée.</p>}

			{connections.map((connection) => {
				const badge = connectionBadge(connection);
				return (
					<section key={connection.id} className="bank-connection">
						<h3>
							{connection.aspspName}{" "}
							<span className={`connection-status ${badge.className}`}>{badge.label}</span>
							<p>
								<button
									type="button"
									onClick={() => renewMutation.mutate(connection.id)}
									disabled={renewMutation.isPending}
								>
									<i className="fa-solid fa-key"></i> Renouveler l'autorisation
								</button>
								<button
									type="button"
									onClick={() => remove(connection)}
									disabled={deleteMutation.isPending}
								>
									<i className="fa-solid fa-trash"></i> Supprimer
								</button>
							</p>
						</h3>
						<p>
							Dernière synchronisation réussie : {formatDateTime(connection.lastSyncSuccessAt)}
							{connection.validUntil && (
								<>
									<br />
									Autorisation valable jusqu'au{" "}
									{new Date(connection.validUntil).toLocaleDateString("fr-FR")}
								</>
							)}
						</p>
						{connection.lastError && connection.status !== "authorized" && (
							<p className="error">{connection.lastError}</p>
						)}

						<table className="list alternate bank-connection-accounts">
							<thead>
								<tr>
									<th>Compte bancaire</th>
									<th>IBAN</th>
									<th>Compte lié</th>
									<th>Importer depuis</th>
									<th>Actif</th>
								</tr>
							</thead>
							<tbody>
								{connection.accounts.map((bankAccount) => (
									<tr key={bankAccount.id}>
										<td>{bankAccount.name ?? "—"}</td>
										<td>{bankAccount.iban ?? "—"}</td>
										<td>
											<select
												value={bankAccount.accountId ?? ""}
												onChange={(e) =>
													accountMutation.mutate({
														id: bankAccount.id,
														data: {
															accountId: e.target.value ? Number(e.target.value) : null,
														},
													})
												}
											>
												<option value="">Non lié (non synchronisé)</option>
												{banks.map((bank) => (
													<optgroup key={bank.id} label={bank.name}>
														{bank.accounts.map((account) => (
															<option key={account.id} value={account.id}>
																{account.name}
															</option>
														))}
													</optgroup>
												))}
											</select>
										</td>
										<td>
											<input
												type="date"
												defaultValue={bankAccount.syncFrom}
												onBlur={(e) =>
													e.target.value &&
													e.target.value !== bankAccount.syncFrom &&
													accountMutation.mutate({
														id: bankAccount.id,
														data: { syncFrom: e.target.value },
													})
												}
											/>
										</td>
										<td>
											<input
												type="checkbox"
												checked={bankAccount.enabled}
												onChange={(e) =>
													accountMutation.mutate({
														id: bankAccount.id,
														data: { enabled: e.target.checked },
													})
												}
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</section>
				);
			})}
			<Outlet />
		</>
	);
}
