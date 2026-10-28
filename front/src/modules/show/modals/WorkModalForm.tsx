import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { saveWork, workDetailsQuery } from "../api";
import WorkFormComponent from "../forms/WorkForm";
import { type WorkForm, WorkFormSchema, WorkFormSchemaTransformation, onSubmitWork } from "../forms/WorkForm.utils";

interface Inputs extends WorkForm {}

export default function WorkModalForm({ workId, returnTo }: { workId?: string; returnTo: string }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const data = useOptionalSuspenseQuery(workId ? workDetailsQuery(workId) : undefined);
	const saveMutation = useMutation({
		mutationFn: saveWork,
		onSuccess: () => {
			methods.reset();
			if (workId) {
				queryClient.invalidateQueries({ queryKey: ["shows", "works", workId] });
				if (returnTo.endsWith("/works")) {
					queryClient.invalidateQueries({ queryKey: ["shows", "works"] });
				}
			} else {
				queryClient.invalidateQueries({ queryKey: ["shows", "works"] });
			}
			closeModal();
		},
	});

	let defaultValues: Inputs | null = null;
	if (data) {
		defaultValues = {
			work: WorkFormSchemaTransformation.parse(data),
		};
	}

	const methods = useForm<Inputs>({
		resolver: zodResolver(WorkFormSchema),
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
		const dataWork = onSubmitWork(data);
		saveMutation.mutate(dataWork);
	};

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal className="form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
					<div className="dialog-header">
						<h2 id="dialog-title">{workId ? "Modifier l'oeuvre" : "Ajouter une oeuvre"}</h2>
					</div>
					<div className="dialog-body">
						<WorkFormComponent />
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
