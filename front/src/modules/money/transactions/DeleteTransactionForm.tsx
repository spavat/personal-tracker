import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
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
		<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Confirmation de suppression</h2>
			</div>

			<div className="dialog-body">
				<p>Êtes-vous sur de supprimer la transaction</p>
				<p>
					{data.name} - {data.description}
					<br />
					{data.amount} €
				</p>
				<MutationError error={deleteMutation.error} />
			</div>

			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Fermer
				</button>
				<button type="submit" className="main" onClick={save} disabled={deleteMutation.isPending}>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
