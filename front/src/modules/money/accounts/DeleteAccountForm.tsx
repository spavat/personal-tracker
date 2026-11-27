import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { accountDetailsQuery, deleteAccount } from "../api";

interface Form {
	accountId: number;
	returnTo: string;
}

export default function DeleteAccountForm({ accountId, returnTo }: Form) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data } = useSuspenseQuery(accountDetailsQuery(String(accountId)));
	const mutation = useMutation({
		mutationFn: deleteAccount,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["money", "banks"] });
			queryClient.invalidateQueries({ queryKey: ["money", "accounts"] });
			closeModal();
		},
	});

	function save() {
		mutation.mutate(accountId);
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
			title={`Supprimer le compte "${data.name}"`}
			onClose={closeModal}
			onConfirm={save}
			mutation={mutation}
			canDelete={!data.paymentTypes.length}
		>
			<p>
				Moyen de paiement associé à "{data.name}" ?{" "}
				{data.paymentTypes.length ? <>❌ {data.paymentTypes.length} compte(s)</> : "✅ Aucun"}
			</p>
		</ConfirmDeleteModal>
	);
}
