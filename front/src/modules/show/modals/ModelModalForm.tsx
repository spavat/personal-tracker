import { zodResolver } from "@hookform/resolvers/zod";
import { SaveModelBodyRequestSchema } from "@personal-tracker/shared/show";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { modelDetailsQuery, saveModel } from "../api";
import ModelRoleFormComponent from "../forms/ModelRoleForm";
import { ModelForm, onSubmitModel } from "../forms/ModelRoleForm.utils";

interface Inputs extends ModelForm {}

export default function ModelModalForm({
	modelId,
	spectacleId,
	returnTo,
}: {
	modelId?: string;
	spectacleId: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const data = useOptionalSuspenseQuery(modelId ? modelDetailsQuery(modelId) : undefined);
	const saveMutation = useMutation({
		mutationFn: saveModel,
		onSuccess: () => {
			methods.reset();
			queryClient.invalidateQueries({ queryKey: ["shows", "spectacles", spectacleId] });
			if (modelId) {
				queryClient.invalidateQueries({ queryKey: ["shows", "models", modelId] });
			}
			closeModal();
		},
	});

	let defaultValues: Inputs | null = null;
	if (data) {
		defaultValues = {
			id: data?.id,
			name: data?.name,
			spectacleId: data?.spectacleId,
			roles: data?.roles.map((r) => {
				const { id, main, name, order, artistId } = r;
				return { id, main, name, order, artistId };
			}),
		};
	} else {
		defaultValues = {
			spectacleId: parseInt(spectacleId ?? "0", 10),
			name: "",
			roles: [],
		};
	}

	const methods = useForm<Inputs>({
		resolver: zodResolver(SaveModelBodyRequestSchema),
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: defaultValues as any,
	});

	function closeModal() {
		methods.reset();
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		const dataModel = onSubmitModel(data);
		saveMutation.mutate(dataModel);
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className="modal form dialog-large" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">{modelId ? "Modifier le modèle" : "Ajouter un modèle"}</h2>
					</div>
					<div className="dialog-body single-panel">
						<ModelRoleFormComponent />
					</div>

					<div className="dialog-footer">
						<MutationError error={saveMutation.error} />
						<button type="button" onClick={closeModal}>
							Annuler
						</button>
						<button type="submit" className="main" disabled={saveMutation.isPending}>
							Enregistrer
						</button>
					</div>
				</Modal>
			</form>
		</FormProvider>
	);
}
