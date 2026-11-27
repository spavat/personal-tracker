import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { deleteTransaction, transactionQuery } from "../api";

interface Form {
	transactionId: number;
	returnTo: string;
}

export default function DeleteTransactionForm({ transactionId, returnTo }: Form) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data } = useSuspenseQuery(transactionQuery(transactionId));
	const deleteMutation = useMutation({
		mutationFn: deleteTransaction,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["money", "transactions"] });
			closeModal();
		},
	});

	function save() {
		deleteMutation.mutate(transactionId);
	}

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	return (
		<ConfirmDeleteModal
			title="Confirmation de suppression"
			onClose={closeModal}
			onConfirm={save}
			mutation={deleteMutation}
		>
			<p>Êtes-vous sur de supprimer la transaction</p>
			<p>
				{data.name} - {data.description}
				<br />
				{data.amount} €
			</p>
		</ConfirmDeleteModal>
	);
}
