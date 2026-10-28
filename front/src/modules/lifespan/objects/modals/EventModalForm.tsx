import { LifespanDisposeCauseSchema, LifespanEventTypeSchema } from "@personal-tracker/shared/lifespan";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { SubmitHandler, useForm, useWatch } from "react-hook-form";

import Modal from "../../../../components/modal";
import MutationError from "../../../../components/mutation-error";
import { objectDetailsQuery, saveObject } from "../../api";
import { DISPOSE_CAUSE_LABELS, EVENT_TYPE_LABELS } from "../../labels";

type EventFormInputs = {
	type: string;
	date: string;
	cause: string;
	comment: string;
};

const defaultValues: EventFormInputs = {
	type: "",
	date: "",
	cause: "",
	comment: "",
};

export default function EventModalForm({
	objectId,
	eventId,
	returnTo,
}: {
	objectId: string;
	eventId?: string;
	returnTo: string;
}) {
	const isEdit = Boolean(eventId);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: object } = useSuspenseQuery(objectDetailsQuery(objectId));
	const event = object.events.find((e) => e.id === eventId);

	const {
		register,
		handleSubmit,
		reset,
		control,
		formState: { errors },
	} = useForm<EventFormInputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: event
			? {
					type: event.type,
					date: event.date,
					cause: event.cause ?? "",
					comment: event.comment ?? "",
				}
			: defaultValues,
	});

	const saveMutation = useMutation({
		mutationFn: saveObject,
		onSuccess: () => {
			reset(defaultValues);
			queryClient.invalidateQueries({ queryKey: ["lifespan", "objects"] });
			closeModal();
		},
	});

	function closeModal() {
		reset(defaultValues);
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	const onSubmit: SubmitHandler<EventFormInputs> = (data) => {
		saveMutation.mutate({
			objectId,
			event: {
				...(eventId ? { id: eventId } : {}),
				type: data.type,
				date: data.date,
				...(data.type === "dispose" ? { cause: data.cause } : {}),
				...(data.comment ? { comment: data.comment } : {}),
			},
		});
	};

	const selectedType = useWatch({ control, name: "type" });

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">{isEdit ? "Modifier l'évènement" : "Ajouter un évènement"}</h2>
				</div>

				<div className="dialog-body">
					<div className="form-grid">
						<label className="form-field">
							<span>Type</span>
							<select {...register("type", { required: true })}>
								<option value=""></option>
								{LifespanEventTypeSchema.options.map((type) => (
									<option key={type} value={type}>
										{EVENT_TYPE_LABELS[type]}
									</option>
								))}
							</select>
							{errors.type && <span className="error">Le type est obligatoire</span>}
						</label>

						<label className="form-field">
							<span>Date</span>
							<input type="date" {...register("date", { required: true })} />
							{errors.date && <span className="error">La date est obligatoire</span>}
						</label>

						{selectedType === "dispose" && (
							<label className="form-field">
								<span>Cause</span>
								<select {...register("cause", { required: true })}>
									<option value=""></option>
									{LifespanDisposeCauseSchema.options.map((cause) => (
										<option key={cause} value={cause}>
											{DISPOSE_CAUSE_LABELS[cause]}
										</option>
									))}
								</select>
								{errors.cause && <span className="error">La cause est obligatoire</span>}
							</label>
						)}

						<label className="form-field full-width">
							<span>Commentaire</span>
							<textarea autoComplete="off" {...register("comment")} />
						</label>
					</div>
				</div>

				<div className="dialog-footer">
					<MutationError error={saveMutation.error} />
					<button type="button" onClick={closeModal}>
						Annuler
					</button>
					<button type="submit" className="main" disabled={saveMutation.isPending}>
						{saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
					</button>
				</div>
			</Modal>
		</form>
	);
}
