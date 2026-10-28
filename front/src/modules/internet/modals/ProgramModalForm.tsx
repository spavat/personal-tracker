import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { programDetailsQuery, save } from "../api";
import ProgramForm from "../forms/ProgramForm";
import { onSubmitProgram, type ProgramInputs } from "../forms/ProgramForm.utils";

interface Inputs extends ProgramInputs {}

export default function ProgramModalForm({ programId, returnTo }: { programId?: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const data = useOptionalSuspenseQuery(programId ? programDetailsQuery(programId) : undefined);
	const saveMutation = useMutation({
		mutationFn: save,
		onSuccess: () => {
			methods.reset();
			queryClient.invalidateQueries({ queryKey: ["programs"] });
			queryClient.invalidateQueries({ queryKey: ["program", programId] });
			closeModal();
		},
	});

	let defaultValues: Inputs | null = null;
	if (data?.episodes) {
		const { episodes, tags, links, refs, ...props } = data;
		defaultValues = {
			program: {
				...props,
				...(refs ? { refs: Object.entries(refs).map(([key, value]) => ({ key: key as any, value })) } : {}),
				// refs: refs ? Object.entries(refs).map(([key, value]) => ({ key, value })) : [],
				tags: tags?.map((t) => ({ value: t })) ?? [],
				links: links?.map((l) => ({ value: l })) ?? [],
			} as any,
		};
	}

	const methods = useForm<Inputs>({
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
		const dataProgram = onSubmitProgram(data);
		saveMutation.mutate({ program: dataProgram });
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">{programId ? "Modifier programme" : "Ajouter programme"}</h2>
					</div>

					<div className="dialog-body single-panel">
						<ProgramForm />
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
