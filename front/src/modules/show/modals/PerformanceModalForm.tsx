import { zodResolver } from "@hookform/resolvers/zod";
import { SavePerformanceBodyRequest, SavePerformanceBodyRequestSchema } from "@personal-tracker/shared/show";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import z from "zod";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { performanceDetailsQuery, savePerformance, spectacleDetailsQuery } from "../api";
import PerformanceFormComponent from "../forms/PerformanceForm";
import { onSubmitPerformance } from "../forms/PerformanceForm.utils";
import PlaceFormComponent from "../forms/PlaceForm";
import SpectacleFormComponent from "../forms/SpectacleForm";
import WorkFormComponent from "../forms/WorkForm";

// casting_status and casting_origin have defaults: optional in the form
type Inputs = z.input<typeof SavePerformanceBodyRequestSchema>;

export default function PerformanceModalForm({
	spectacleId,
	performanceId,
	returnTo,
}: {
	spectacleId?: string;
	performanceId?: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const spectacleData = useOptionalSuspenseQuery(spectacleId ? spectacleDetailsQuery(spectacleId) : undefined);
	const performanceData = useOptionalSuspenseQuery(
		performanceId ? performanceDetailsQuery(performanceId) : undefined,
	);
	const saveMutation = useMutation({
		mutationFn: savePerformance,
		onSuccess: () => {
			methods.reset();
			if (spectacleId) {
				queryClient.invalidateQueries({ queryKey: ["shows", "spectacles", spectacleId] });
			} else {
				queryClient.invalidateQueries({ queryKey: ["shows", "spectacles"] });
			}
			queryClient.invalidateQueries({ queryKey: ["shows", "performances"] });
			closeModal();
		},
	});

	const [showSpectacle, setShowSpectacle] = useState(false);
	const [showPlace, setShowPlace] = useState(false);
	const [showWork, setShowWork] = useState(false);

	let defaultValues: Inputs | null = null;
	if (spectacleData) {
		defaultValues = {
			performance: {
				spectacleId: spectacleData.id,
				canceled: false,
			} as any,
		};
	} else if (performanceData) {
		// Only the performance fields: the place, spectacle and roles are not edited here
		const { id, date, canceled, seat, placeId, spectacleId, casting_status, casting_origin } = performanceData;
		defaultValues = {
			performance: {
				id,
				// "YYYY-MM-DD HH:mm:ss" from the database, a datetime-local input needs a "T"
				date: date.replace(" ", "T"),
				canceled,
				seat,
				placeId,
				spectacleId,
				casting_status,
				casting_origin,
			},
		};
	}

	const methods = useForm<Inputs, unknown, SavePerformanceBodyRequest>({
		resolver: zodResolver(SavePerformanceBodyRequestSchema),
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

	const onSubmit: SubmitHandler<SavePerformanceBodyRequest> = (data) => {
		const dataPerformance = onSubmitPerformance(data);
		saveMutation.mutate(dataPerformance);
	};

	const showFormPart = useCallback((type: "work" | "spectacle" | "place", value = true) => {
		switch (type) {
			case "place":
				setShowPlace(value);
				break;
			case "spectacle":
				setShowSpectacle(value);
				break;
		}
	}, []);

	// A hidden panel must not be validated nor sent
	const { unregister } = methods;
	useEffect(() => {
		if (!showPlace) {
			unregister("place");
		}
	}, [showPlace, unregister]);
	useEffect(() => {
		if (!showSpectacle) {
			unregister("spectacle");
		}
	}, [showSpectacle, unregister]);
	// The new work belongs to the new spectacle
	const showNewWork = showSpectacle && showWork;
	useEffect(() => {
		if (!showNewWork) {
			unregister("work");
		}
	}, [showNewWork, unregister]);

	const showRightPanel = Boolean(showPlace || showSpectacle);

	return (
		<FormProvider {...methods}>
			<form onSubmit={methods.handleSubmit(onSubmit)}>
				<Modal
					className={`form modal ${showRightPanel ? "dialog-extralarge" : "dialog-medium"}`}
					isOpen={true}
					onClose={closeModal}
					hasCloseBtn={true}
				>
					<div className="dialog-header">
						<h2 id="dialog-title">
							{performanceId ? "Modifier la représentation" : "Ajouter une représentation"}
						</h2>
					</div>
					<div className="dialog-body double-panel">
						<div className="form_part_1">
							<PerformanceFormComponent showFormPart={showFormPart} />
						</div>
						{showRightPanel && (
							<div className="form_part_2">
								{showSpectacle && (
									<SpectacleFormComponent
										title="Nouveau spectacle"
										onNewWork={() => setShowWork(true)}
									/>
								)}
								{showNewWork && <WorkFormComponent title="Nouvelle oeuvre" />}
								{showPlace && <PlaceFormComponent title="Nouveau lieu" />}
							</div>
						)}
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
