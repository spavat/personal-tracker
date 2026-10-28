import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { placeDetailsQuery, savePlace } from "../api";
import PlaceFormComponent, { PlaceFormerNamesFormComponent } from "../forms/PlaceForm";
import {
	type PlaceForm,
	PlaceFormSchema,
	PlaceFormSchemaTransformation,
	onSubmitPlace,
} from "../forms/PlaceForm.utils";

interface Inputs extends PlaceForm {}

export default function PlaceModalForm({ placeId, returnTo }: { placeId?: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const data = useOptionalSuspenseQuery(placeId ? placeDetailsQuery(placeId, false) : undefined);
	const saveMutation = useMutation({
		mutationFn: savePlace,
		onSuccess: () => {
			methods.reset();
			if (placeId) {
				queryClient.invalidateQueries({ queryKey: ["shows", "places", placeId] });
				if (returnTo.endsWith("/places")) {
					queryClient.invalidateQueries({ queryKey: ["shows", "places"] });
				}
			} else {
				queryClient.invalidateQueries({ queryKey: ["shows", "places"] });
			}
			closeModal();
		},
	});

	let defaultValues: Inputs | null = null;
	if (data) {
		defaultValues = {
			place: PlaceFormSchemaTransformation.parse(data),
		};
	} else {
		defaultValues = { place: { formerNames: [] } as any };
	}

	const methods = useForm<Inputs>({
		resolver: zodResolver(PlaceFormSchema),
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
		const dataPlace = onSubmitPlace(data);
		saveMutation.mutate(dataPlace);
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">{placeId ? "Modifier le lieu" : "Ajouter un lieu"}</h2>
					</div>
					<div className="dialog-body">
						<PlaceFormComponent />
						<PlaceFormerNamesFormComponent />
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
