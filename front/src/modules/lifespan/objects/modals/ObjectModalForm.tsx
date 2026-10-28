import { LifespanDisposeCauseSchema, LifespanEventTypeSchema, LifespanObject } from "@personal-tracker/shared/lifespan";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { SubmitHandler, useFieldArray, useForm, useWatch } from "react-hook-form";

import Modal from "../../../../components/modal";
import MutationError from "../../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../../hooks/use-optional-suspense-query";
import { categoriesQuery, objectDetailsQuery, saveObject } from "../../api";
import { DISPOSE_CAUSE_LABELS, EVENT_TYPE_LABELS } from "../../labels";

type EventInput = {
	id: string; // empty for a new event
	type: string;
	date: string;
	cause: string;
	comment: string;
};

type ObjectFormInputs = {
	name: string;
	description: string;
	type: string;
	categoryId: string;
	events: Array<EventInput>;
};

const defaultValues: ObjectFormInputs = {
	name: "",
	description: "",
	type: "",
	categoryId: "",
	events: [],
};

export default function ObjectModalForm({ id, returnTo }: { id?: string; returnTo: string }) {
	const isEdit = Boolean(id);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const { data: categories } = useSuspenseQuery(categoriesQuery());
	const object = useOptionalSuspenseQuery(id ? objectDetailsQuery(id) : undefined);

	const {
		control,
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<ObjectFormInputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: object
			? {
					name: object.name,
					description: object.description ?? "",
					type: object.type ?? "",
					categoryId: object.categoryId,
					// chronological, so events added at the bottom stay in order
					events: object.events.toReversed().map((event) => ({
						id: event.id,
						type: event.type,
						date: event.date,
						cause: event.cause ?? "",
						comment: event.comment ?? "",
					})),
				}
			: defaultValues,
	});
	const watchedEvents = useWatch({ control, name: "events" });

	const {
		fields: fieldsEvents,
		append: appendEvent,
		remove: removeEvent,
	} = useFieldArray({ control, name: "events" });

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
		// href (not to) so a "returnTo" carrying search params (e.g. timeline filters) is restored
		navigate({ href: returnTo, replace: true, resetScroll: false });
	}

	const onSubmit: SubmitHandler<ObjectFormInputs> = (data) => {
		const object: Partial<LifespanObject> = {
			...(id ? { id } : {}),
			name: data.name,
			...(data.description ? { description: data.description } : {}),
			// always sent (even empty) so clearing the field is saved on update
			type: data.type.trim(),
			categoryId: data.categoryId,
		};
		const events = data.events
			.filter((event) => event.type && event.date)
			.map((event) => ({
				...(event.id ? { id: event.id } : {}),
				type: event.type,
				date: event.date,
				...(event.type === "dispose" ? { cause: event.cause } : {}),
				...(event.comment ? { comment: event.comment } : {}),
			}));

		// in edit mode the list is always sent: it replaces the stored events (so removals are saved)
		saveMutation.mutate({ object, ...(isEdit || events.length ? { events } : {}) });
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">{isEdit ? "Modifier l'objet" : "Ajouter un objet"}</h2>
				</div>

				<div className="dialog-body">
					<div className="single-panel">
						<div className="panel">
							<div className="form-grid">
								<label className="form-field full-width">
									<span>
										Nom <span className="req">*</span>
									</span>
									<input type="text" autoComplete="off" {...register("name", { required: true })} />
									{errors.name && <span className="error">Le nom est obligatoire</span>}
								</label>

								<label className="form-field full-width">
									<span>
										Catégorie <span className="req">*</span>
									</span>
									<select {...register("categoryId", { required: true })}>
										<option value=""></option>
										{categories.map((category) => (
											<option key={category.id} value={category.id}>
												{category.name}
											</option>
										))}
									</select>
									{errors.categoryId && <span className="error">La catégorie est obligatoire</span>}
								</label>

								<label className="form-field full-width">
									<span>Type</span>
									<input
										type="text"
										autoComplete="off"
										placeholder="ex : souris, clavier, écran…"
										{...register("type")}
									/>
								</label>

								<label className="form-field full-width">
									<span>Description</span>
									<textarea autoComplete="off" {...register("description")} />
								</label>
							</div>
						</div>

						<div className="panel">
							<h3>Évènements</h3>
							<div className="form-field full-width">
								{fieldsEvents.map((field, index) => (
									<div key={field.id} className="full-fields-row">
										<select {...register(`events.${index}.type` as const, { required: true })}>
											<option value=""></option>
											{LifespanEventTypeSchema.options.map((type) => (
												<option key={type} value={type}>
													{EVENT_TYPE_LABELS[type]}
												</option>
											))}
										</select>
										<input
											type="date"
											{...register(`events.${index}.date` as const, { required: true })}
										/>
										{watchedEvents[index]?.type === "dispose" && (
											<select {...register(`events.${index}.cause` as const, { required: true })}>
												<option value=""></option>
												{LifespanDisposeCauseSchema.options.map((cause) => (
													<option key={cause} value={cause}>
														{DISPOSE_CAUSE_LABELS[cause]}
													</option>
												))}
											</select>
										)}
										<input
											type="text"
											placeholder="Commentaire"
											className="flex"
											{...register(`events.${index}.comment` as const)}
										/>
										<button type="button" onClick={() => removeEvent(index)} title="Supprimer">
											<i className="fa-regular fa-trash-can"></i>
										</button>
									</div>
								))}
								<button
									type="button"
									onClick={() => appendEvent({ id: "", type: "", date: "", cause: "", comment: "" })}
								>
									<i className="fa-regular fa-plus"></i> Ajouter un évènement
								</button>
								{errors.events?.some?.((event) => event?.type || event?.date) && (
									<span className="error">
										Le type et la date de chaque évènement sont obligatoires
									</span>
								)}
								{errors.events?.some?.((event) => event?.cause) && (
									<span className="error">La cause d'une sortie est obligatoire</span>
								)}
							</div>
						</div>
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
