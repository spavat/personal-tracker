import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
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
		<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer la banque "{data.name}"</h2>
			</div>
			<div className="dialog-body">
				<p>
					Comptes associés à "{data.name}" ?{" "}
					{data.accounts.length ? <>❌ {data.accounts.length} compte(s)</> : "✅ Aucun"}
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
					disabled={Boolean(data.accounts.length) || mutation.isPending}
				>
					Supprimer
				</button>
			</div>
		</Modal>
	);
}
