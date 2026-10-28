import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { artistDetailsQuery, saveArtist } from "../api";
import ArtistFormComponent from "../forms/ArtistForm";
import {
	type ArtistForm,
	ArtistFormSchema,
	ArtistFormSchemaTransformation,
	onSubmitArtist,
} from "../forms/ArtistForm.utils";

interface Inputs extends ArtistForm {}

export default function ArtistModalForm({ artistId, returnTo }: { artistId?: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const data = useOptionalSuspenseQuery(artistId ? artistDetailsQuery(artistId, false) : undefined);
	const saveMutation = useMutation({
		mutationFn: saveArtist,
		onSuccess: () => {
			methods.reset();
			if (artistId) {
				queryClient.invalidateQueries({ queryKey: ["shows", "artists", artistId] });
				if (returnTo.endsWith("/artists")) {
					queryClient.invalidateQueries({ queryKey: ["shows", "artists"] });
				}
			} else {
				queryClient.invalidateQueries({ queryKey: ["shows", "artists"] });
			}
			closeModal();
		},
	});

	let defaultValues: Inputs | null = null;
	if (data) {
		defaultValues = {
			artist: ArtistFormSchemaTransformation.parse(data),
		};
	}

	const methods = useForm<Inputs>({
		resolver: zodResolver(ArtistFormSchema),
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
		const dataArtist = onSubmitArtist(data);
		saveMutation.mutate(dataArtist);
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className="form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">{artistId ? "Modifier l'artiste" : "Ajouter un artiste"}</h2>
					</div>
					<div className="dialog-body">
						<ArtistFormComponent />
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
