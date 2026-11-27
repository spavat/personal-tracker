import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
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
		<ConfirmDeleteModal
			title={`Supprimer le type de paiement "${data.name}"`}
			onClose={closeModal}
			onConfirm={save}
			mutation={mutation}
			canDelete={!data.transactions.length}
		>
			<p>
				Transactions associées à "{data.name}" ?{" "}
				{data.transactions.length ? <>❌ {data.transactions.length} transactions(s)</> : "✅ Aucun"}
			</p>
		</ConfirmDeleteModal>
	);
}
