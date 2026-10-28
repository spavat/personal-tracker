import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { deletePaymentType, paymentTypeDetailsQuery } from "../api";

interface Form {
	paymentTypeId: number;
	returnTo: string;
}

export default function DeletePaymentTypeForm({ paymentTypeId, returnTo }: Form) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data } = useSuspenseQuery(paymentTypeDetailsQuery(paymentTypeId));
	const mutation = useMutation({
		mutationFn: deletePaymentType,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["money", "banks"] });
			queryClient.invalidateQueries({ queryKey: ["money", "accounts"] });
			queryClient.invalidateQueries({ queryKey: ["money", "paymentTypes"] });
			closeModal();
		},
	});

	function save() {
		mutation.mutate(paymentTypeId);
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
				<h2 id="dialog-title">Supprimer le type de paiement "{data.name}"</h2>
			</div>
			<div className="dialog-body">
				<p>
					Transactions associées à "{data.name}" ?{" "}
					{data.transactions.length ? <>❌ {data.transactions.length} transactions(s)</> : "✅ Aucun"}
				</p>
				<MutationError error={mutation.error} />
			</div>

			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Fermer
				</button>
				<button
					type="submit"
					className="main"
					onClick={save}
					disabled={Boolean(data.transactions.length) || mutation.isPending}
				>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
