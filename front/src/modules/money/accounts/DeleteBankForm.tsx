import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
import { bankQuery, deleteBank } from "../api";

interface Form {
	bankId: number;
	returnTo: string;
}

export default function DeleteBankForm({ bankId, returnTo }: Form) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data } = useSuspenseQuery(bankQuery(bankId));
	const mutation = useMutation({
		mutationFn: deleteBank,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["money", "banks"] });
			closeModal();
		},
	});

	function save() {
		mutation.mutate(bankId);
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
			title={`Supprimer la banque "${data.name}"`}
			onClose={closeModal}
			onConfirm={save}
			mutation={mutation}
			canDelete={!data.accounts.length}
		>
			<p>
				Comptes associés à "{data.name}" ?{" "}
				{data.accounts.length ? <>❌ {data.accounts.length} compte(s)</> : "✅ Aucun"}
			</p>
		</ConfirmDeleteModal>
	);
}
