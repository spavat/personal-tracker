import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { getCurrentOrPreviousDate } from "../../../utils";
import { mangaDetailsQuery, save } from "../api";
import ReadingFormComponent from "../forms/ReadingForm";
import {
	onSubmitReading,
	ReadingDataTransformation,
	type ReadingForm,
	ReadingFormSchema,
} from "../forms/ReadingForm.utils";

interface Inputs extends ReadingForm {
	mangaId: string;
}
// mangaId is part of the form values: kept in the schema so the resolver doesn't strip it
const InputsSchema = ReadingFormSchema.extend({ mangaId: z.uuid() });

const defaultValues = {
	reading: {
		name: "",
		date: getCurrentOrPreviousDate(),
		contextTags: [],
	},
};

export default function EditReadingModalForm({
	mangaId,
	readingId,
	returnTo,
}: {
	mangaId: string;
	readingId?: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const isEditing = Boolean(mangaId && readingId);

	const data = useOptionalSuspenseQuery(isEditing ? mangaDetailsQuery(mangaId) : undefined);

	const reading = data?.readings?.find((r: any) => r.id === readingId) ?? defaultValues;
	const saveMutation = useMutation({
		mutationFn: save,
		onSuccess: () => {
			methods.reset();
			queryClient.invalidateQueries({ queryKey: ["reading", "mangas"] });
			queryClient.invalidateQueries({ queryKey: ["reading", "manga", mangaId] });
			closeModal();
		},
	});

	const methods = useForm<Inputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: isEditing
			? { mangaId: mangaId ?? "", reading: ReadingDataTransformation.parse(reading) }
			: { ...defaultValues, mangaId },
		resolver: zodResolver(InputsSchema),
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
		const dataReading = onSubmitReading(data);
		saveMutation.mutate({
			mangaId: data.mangaId,
			reading: dataReading,
		});
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className={"form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">{isEditing ? "Modifier" : "Ajouter"} lecture</h2>
					</div>
					<div className="dialog-body single-panel">
						<ReadingFormComponent />
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
