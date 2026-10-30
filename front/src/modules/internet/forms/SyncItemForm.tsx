import { SaveBodyRequestType, SyncResponse } from "@personal-tracker/shared/internet";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";

import MutationError from "../../../components/mutation-error";
import { deleteSyncProposal, programsQuery, validateSyncProposal } from "../api";
import EpisodeForm from "./EpisodeForm";
import { type EpisodeInputs, onSubmitEpisode } from "./EpisodeForm.utils";
import ProgramForm from "./ProgramForm";
import { onSubmitProgram, type ProgramInputs } from "./ProgramForm.utils";

interface Inputs extends EpisodeInputs, ProgramInputs {
	programId: string;
}

type SyncItem = SyncResponse[number];

function toDefaultEpisode(item: SyncItem): Inputs["episode"] {
	const proposition = item.proposition;
	return {
		name: proposition?.name ?? item.origin.episode,
		duration: proposition?.duration as number,
		durationReal: proposition?.durationReal,
		date: proposition?.date ?? item.origin.datetime.slice(0, 10),
		type: proposition?.type as string,
		link: proposition?.link ?? "",
		externalId: proposition?.externalId ?? item.origin.externalId,
		tags: (proposition?.tags ?? []).map((t) => ({ value: t })),
		contextTags: (proposition?.contextTags ?? []).map((t) => ({ value: t })),
		created: proposition?.created,
	};
}

export default function SyncItemForm({ item, onDone }: { item: SyncItem; onDone: () => void }) {
	const programId = item.proposition?.programId;
	const [showAddProgramPanel, setShowAddProgramPanel] = useState(false);
	const queryClient = useQueryClient();

	const programs = useQuery({ ...programsQuery(), enabled: !programId });

	const methods = useForm<Inputs>({
		defaultValues: {
			programId: programId ?? "",
			episode: toDefaultEpisode(item),
		},
	});

	const saveMutation = useMutation({
		mutationFn: (data: SaveBodyRequestType) => validateSyncProposal(item.id, data),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["programs"] });
			if (variables.programId) {
				queryClient.invalidateQueries({ queryKey: ["program", variables.programId] });
			}
			onDone();
		},
	});

	const deleteMutation = useMutation({
		mutationFn: () => deleteSyncProposal({ id: item.id }),
		onSuccess: onDone,
	});

	function onChangeProgramId() {
		setShowAddProgramPanel(false);
		methods.setValue("program", { name: "" });
	}

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		const dataEpisode = onSubmitEpisode(data);
		const dataProgram = showAddProgramPanel ? onSubmitProgram(data) : null;
		saveMutation.mutate({
			episode: { ...dataEpisode },
			programId: data.programId,
			...(!data.programId ? { program: { ...dataProgram } } : {}),
		} as any);
	};

	return (
		<FormProvider {...methods}>
			<form className="form" onSubmit={methods.handleSubmit(onSubmit)}>
				{!programId && showAddProgramPanel && (
					<div className="double-panel">
						<div className="form_part_1">
							<div className="panel title">
								<h3>Programme</h3>
								<button type="button" onClick={() => setShowAddProgramPanel((b) => !b)}>
									{showAddProgramPanel ? "Choisir existant" : "+ Nouveau"}
								</button>
							</div>
							<ProgramForm />
						</div>
						<div className="form_part_2">
							<EpisodeForm />
						</div>
					</div>
				)}
				{!programId && !showAddProgramPanel && (
					<div className="single-panel">
						<div className="panel program">
							<div className="title">
								<h3>Programme</h3>
								<button type="button" onClick={() => setShowAddProgramPanel((b) => !b)}>
									{showAddProgramPanel ? "Choisir existant" : "+ Nouveau"}
								</button>
							</div>
							<div className="form-grid">
								<label className="form-field full-width">
									<select {...methods.register("programId", { onChange: onChangeProgramId })}>
										<option value=""></option>
										{programs.data?.map((p) => (
											<option value={p.id} key={p.id}>
												{p.name}
											</option>
										))}
									</select>
								</label>
							</div>
						</div>
						<EpisodeForm />
					</div>
				)}
				{programId && (
					<div className="single-panel">
						<EpisodeForm />
					</div>
				)}
				<MutationError error={saveMutation.error ?? deleteMutation.error} />
				<div className="form-footer">
					<button
						type="button"
						onClick={() => deleteMutation.mutate()}
						disabled={saveMutation.isPending || deleteMutation.isPending}
					>
						Supprimer
					</button>
					<button
						type="submit"
						className="main"
						disabled={saveMutation.isPending || deleteMutation.isPending}
					>
						Enregistrer
					</button>
				</div>
			</form>
		</FormProvider>
	);
}
