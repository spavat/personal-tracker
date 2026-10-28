import { zodResolver } from "@hookform/resolvers/zod";
import { SaveResponse } from "@personal-tracker/shared/reading-manga";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { DefaultValues, FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { mangaDetailsQuery, save } from "../api";
import MangaFormComponent from "../forms/MangaForm";
import { MangaDataTransformation, type MangaForm, MangaFormSchema, onSubmitManga } from "../forms/MangaForm.utils";

interface Inputs extends MangaForm {}

export default function MangaModalForm({ mangaId, returnTo }: { mangaId?: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const data = useOptionalSuspenseQuery(mangaId ? mangaDetailsQuery(mangaId) : undefined);
	const saveMutation = useMutation({
		mutationFn: save,
		onSuccess: (data: SaveResponse) => {
			if (mangaId) {
				methods.reset();
				queryClient.invalidateQueries({ queryKey: ["reading", "mangas"] });
				queryClient.invalidateQueries({ queryKey: ["reading", "manga", mangaId] });
				closeModal();
			} else {
				// Insert
				queryClient.invalidateQueries({ queryKey: ["reading", "mangas"] });
				navigate({
					to: "/reading-manga/manga/$mangaId",
					params: { mangaId: data.id },
					replace: true,
				});
			}
		},
	});

	// Empty arrays on insert so the resolver gets every field array
	let defaultValues: DefaultValues<Inputs> = { manga: { author: [], art: [], scenario: [], genres: [] } };
	if (data?.readings) {
		defaultValues = {
			manga: MangaDataTransformation.parse(data),
		};
	}

	const methods = useForm<Inputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues,
		resolver: zodResolver(MangaFormSchema),
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
		const dataManga = onSubmitManga(data);
		saveMutation.mutate({ manga: dataManga });
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">{mangaId ? "Modifier le manga" : "Ajouter un manga"}</h2>
					</div>
					<div className="dialog-body single-panel">
						<MangaFormComponent />
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
