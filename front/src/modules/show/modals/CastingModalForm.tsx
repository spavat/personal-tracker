import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { performanceDetailsQuery, saveCasting } from "../api";
import CastingRoleFormComponent from "../forms/CastingRoleForm";
import { CastingForm, onSubmitCasting } from "../forms/CastingRoleForm.utils";

interface Inputs extends CastingForm {
	model?: number;
}

export default function CastingModalForm({ performanceId, returnTo }: { performanceId: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	// same query as the performance page: the invalidation after saving now refreshes this modal too
	const { data } = useSuspenseQuery(performanceDetailsQuery(performanceId));
	const saveMutation = useMutation({
		mutationFn: saveCasting,
		onSuccess: () => {
			methods.reset();
			if (performanceId) {
				queryClient.invalidateQueries({ queryKey: ["shows", "performances", performanceId] });
			}
			closeModal();
		},
	});

	let defaultValues: Inputs | null = null;
	if (data) {
		defaultValues = {
			performanceId: parseInt(performanceId ?? "0"),
			// copy: the data is shared with the performance page cache
			roles: data.roles.map((r) => ({ ...r, order: 0 })), // Order are processed before submit
		};
	} else {
		defaultValues = {
			performanceId: parseInt(performanceId ?? "0"),
			roles: [],
		};
	}

	const methods = useForm<Inputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: defaultValues as any,
	});

	function applyModel(modelId: number) {
		const model = data.spectacle.models?.find((model) => model.id === modelId);
		if (model) {
			methods.setValue(
				"roles",
				model.roles.map((role) => ({
					order: role.order,
					name: role.name,
					main: role.main,
					artistId: role.artistId ?? 0,
				})),
			);
		}
	}

	function closeModal() {
		methods.reset();
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		const dataCasting = onSubmitCasting(data);
		saveMutation.mutate(dataCasting);
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal
					className="form dialog-extralarge single-panel"
					isOpen={true}
					onClose={closeModal}
					hasCloseBtn={true}
				>
					<div className="dialog-header">
						<h2 id="dialog-title">Casting de la représentation</h2>
					</div>
					<div className="dialog-body">
						{(data.spectacle.models?.length ?? 0) > 0 && (
							<h3>
								Modèle :&nbsp;
								<span>
									<select
										{...methods.register("model", {
											valueAsNumber: true,
											onChange: (e) => applyModel(Number(e.target.value)),
										})}
									>
										<option></option>
										{data.spectacle.models?.map((model) => (
											<option key={model.id} value={model.id}>
												{model.name}
											</option>
										))}
									</select>
								</span>
							</h3>
						)}
						<CastingRoleFormComponent />
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
