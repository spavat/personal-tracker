import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import ConfirmDeleteModal from "../../../components/ConfirmDeleteModal";
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
		<ConfirmDeleteModal
			title={`Supprimer le tag "${data.name}"`}
			onClose={closeModal}
			onConfirm={save}
			mutation={deleteMutation}
			canDelete={!(nbSubTags || nbTransactions)}
		>
			<p>
				Sous tag associé à "{data.name}" ? {nbSubTags ? <>❌ {nbSubTags} tag(s)</> : "✅ Aucun"}
			</p>
			<p>Transactions utilisant ce tag ? {nbTransactions ? <>❌ {nbTransactions} trouvées </> : "✅"}</p>
		</ConfirmDeleteModal>
	);
}
