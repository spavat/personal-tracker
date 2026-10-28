import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm, type SubmitHandler } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { bankQuery, updateBank } from "../api";

type Inputs = {
	name: string;
};

interface Form {
	bankId?: number;
	returnTo: string;
}

const defaultValues = {
	name: "",
};

export default function NewBankForm({ bankId, returnTo }: Form) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const data = useOptionalSuspenseQuery(bankId ? bankQuery(bankId) : undefined);
	const updateMutation = useMutation({
		mutationFn: updateBank,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["money", "banks"] });
			closeModal();
		},
	});

	const { register, handleSubmit, reset } = useForm<Inputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: data ? (data as any) : defaultValues,
	});

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		updateMutation.mutate({ bankId, data });
	};

	function closeModal() {
		reset(defaultValues);
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">{bankId ? "Editer une banque" : "Ajouter une banque"}</h2>
				</div>
				<div className="dialog-body">
					<div className="form-grid">
						<label className="form-field full-width">
							<span>
								Nom <span className="req">*</span>
							</span>
							<input {...register("name", { required: true })} autoComplete="off" />
						</label>
					</div>
				</div>

				<div className="dialog-footer">
					<MutationError error={updateMutation.error} />
					<button type="button" onClick={closeModal}>
						Annuler
					</button>
					<button type="submit" className="main" disabled={updateMutation.isPending}>
						Enregistrer
					</button>
				</div>
			</Modal>
		</form>
	);
}
