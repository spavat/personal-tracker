import { useSuspenseQuery } from "@tanstack/react-query";

import { acceptBankTransaction, bankInboxQuery } from "../api";
import NewTransactionForm from "../NewTransactionForm";

export default function AcceptBankTransactionForm({ id, returnTo }: { id: number; returnTo: string }) {
	const { data: lines } = useSuspenseQuery(bankInboxQuery());
	const line = lines.find((l) => l.id === id);
	if (!line) {
		throw new Error("Opération bancaire introuvable");
	}
	const date = line.transactionDate ?? line.bookingDate;

	return (
		<NewTransactionForm
			returnTo={returnTo}
			bankLine={{
				label: line.label,
				paymentTypeIds: line.paymentTypeIds,
				defaults: {
					name: line.label,
					amount: line.amount,
					date,
					considerationDate: date,
					paymentTypeId: line.suggestedPaymentTypeId ?? 0,
					bankLabel: line.label,
				},
				save: (data) => acceptBankTransaction({ id, data }),
			}}
		/>
	);
}
