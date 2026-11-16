import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import MutationError from "../../../components/MutationError";
import { bankInboxQuery, ignoreBankTransaction, matchBankTransaction } from "../api";

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("fr-FR") : "");

export default function BankInbox() {
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();
	const { data: lines } = useSuspenseQuery(bankInboxQuery());

	const onSuccess = () => {
		queryClient.invalidateQueries({ queryKey: ["money", "banking", "inbox"] });
		queryClient.invalidateQueries({ queryKey: ["money", "transactions"] });
	};
	const matchMutation = useMutation({ mutationFn: matchBankTransaction, onSuccess });
	const ignoreMutation = useMutation({ mutationFn: ignoreBankTransaction, onSuccess });

	return (
		<>
			<h2>Opérations à valider ({lines.length})</h2>

			<MutationError error={matchMutation.error ?? ignoreMutation.error} />
			{lines.length === 0 ? (
				<p>Aucune opération en attente.</p>
			) : (
				<table className="list alternate bank-inbox">
					<thead>
						<tr>
							<th>Date</th>
							<th>Libellé bancaire</th>
							<th>Compte</th>
							<th className="amount">Montant</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{lines.map((line) => (
							<tr key={line.id}>
								<td className="monospace">{formatDate(line.transactionDate ?? line.bookingDate)}</td>
								<td>
									{line.label}
									{line.counterparty && line.counterparty !== line.label && (
										<div className="counterparty">{line.counterparty}</div>
									)}
								</td>
								<td>{line.account?.name ?? "Non lié"}</td>
								<td className={`amount ${line.amount < 0 ? "debit" : "credit"}`}>
									{line.amount.toFixed(2)}
								</td>
								<td className="bank-inbox-actions">
									{line.candidates.map((candidate) => (
										<button
											key={candidate.id}
											type="button"
											title="Rapprocher avec cette transaction saisie à la main"
											disabled={matchMutation.isPending}
											onClick={() =>
												matchMutation.mutate({ id: line.id, transactionId: candidate.id })
											}
										>
											<i className="fa-solid fa-link"></i> Rapprocher : {candidate.name} (
											{formatDate(candidate.date)}
											{candidate.paymentType ? `, ${candidate.paymentType}` : ""})
										</button>
									))}
									<button
										type="button"
										className="main"
										disabled={!line.account}
										onClick={() =>
											navigate({
												to: "/money/banking/inbox/$bankTransactionId/accept",
												params: { bankTransactionId: String(line.id) },
												search: { returnTo: location.pathname },
											})
										}
									>
										<i className="fa-solid fa-check"></i> Valider
									</button>
									<button
										type="button"
										disabled={ignoreMutation.isPending}
										onClick={() => ignoreMutation.mutate(line.id)}
									>
										<i className="fa-solid fa-eye-slash"></i> Ignorer
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			<Outlet />
		</>
	);
}
