import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
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
		<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer le compte "{data.name}"</h2>
			</div>
			<div className="dialog-body">
				<p>
					Moyen de paiement associé à "{data.name}" ?{" "}
					{data.paymentTypes.length ? <>❌ {data.paymentTypes.length} compte(s)</> : "✅ Aucun"}
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
					disabled={Boolean(data.paymentTypes.length) || mutation.isPending}
				>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
