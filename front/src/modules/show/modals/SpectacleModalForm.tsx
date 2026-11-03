import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import { saveSpectacle, spectacleDetailsQuery } from "../api";
import SpectacleInfoFormComponent from "../forms/SpectacleInfoForm";
import { type SpectacleInfoForm, SpectacleInfoFormSchema, toSpectacleInfoForm } from "../forms/SpectacleInfoForm.utils";

export default function SpectacleModalForm({ spectacleId, returnTo }: { spectacleId: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(spectacleDetailsQuery(spectacleId));
	const saveMutation = useMutation({
		mutationFn: saveSpectacle,
		onSuccess: () => {
			methods.reset();
			// the name shows in every show list
			queryClient.invalidateQueries({ queryKey: ["shows"] });
			closeModal();
		},
	});

	const methods = useForm<SpectacleInfoForm>({
		resolver: zodResolver(SpectacleInfoFormSchema) as any,
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: toSpectacleInfoForm(data),
	});

	function closeModal() {
		methods.reset();
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const onSubmit: SubmitHandler<SpectacleInfoForm> = (data) => {
		saveMutation.mutate(data.spectacle);
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className="form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">Modifier le spectacle</h2>
					</div>
					<div className="dialog-body">
						<SpectacleInfoFormComponent />
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
