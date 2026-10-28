import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { deleteTag, tagQuery } from "../api";

interface Form {
	tagId: number;
	returnTo: string;
}

export default function DeleteTagForm({ tagId, returnTo }: Form) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data } = useSuspenseQuery(tagQuery(tagId));
	const deleteMutation = useMutation({
		mutationFn: deleteTag,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["money", "tags"] });
			closeModal();
		},
	});

	function save() {
		deleteMutation.mutate(tagId);
	}

	function closeModal() {
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const nbSubTags = data.children.length;
	const nbTransactions = data.transactions;

	return (
		<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
			<div className="dialog-header">
				<h2 id="dialog-title">Supprimer le tag "{data.name}"</h2>
			</div>
			<div className="dialog-body">
				<p>
					Sous tag associé à "{data.name}" ? {nbSubTags ? <>❌ {nbSubTags} tag(s)</> : "✅ Aucun"}
				</p>
				<p>Transactions utilisant ce tag ? {nbTransactions ? <>❌ {nbTransactions} trouvées </> : "✅"}</p>
				<MutationError error={deleteMutation.error} />
			</div>

			<div className="dialog-footer">
				<button type="button" onClick={closeModal}>
					Fermer
				</button>
				<button
					type="submit"
					className="main"
					onClick={save}
					disabled={Boolean(nbSubTags || nbTransactions) || deleteMutation.isPending}
				>
					Supprimer le tag
				</button>
			</div>
		</Modal>
	);
}
