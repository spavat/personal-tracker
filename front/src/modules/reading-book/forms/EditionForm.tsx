import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";

import EntitySearchSelect from "../../../components/EntitySearchSelect";
import ImageDropZone from "../../../components/ImageDropZone";
import Modal from "../../../components/Modal";
import MutationError from "../../../components/MutationError";
import { bookDetailsQuery, saveEdition } from "../api";
import { coverSrc, EDITION_TYPE_LABELS } from "../utils";
import { type EditionFormData, toEditionFormData, toSaveEdition } from "./EditionForm.utils";

function readImageFile(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => resolve(e.target?.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

export default function EditionForm({
	bookId,
	editionId,
	returnTo,
}: {
	bookId: string;
	editionId?: string;
	returnTo: string;
}) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: book } = useSuspenseQuery(bookDetailsQuery(bookId));
	const edition = book.editions.find(({ id }) => id === editionId);
	const hasReadings = (edition?.readings.length ?? 0) > 0;

	const { control, register, handleSubmit, setValue } = useForm<EditionFormData>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: toEditionFormData(edition, book.models[0]?.id),
	});
	const translators = useFieldArray({ control, name: "translators" });
	const cover = useWatch({ control, name: "cover" });

	const saveMutation = useMutation({
		mutationFn: saveEdition,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["reading", "books"] });
			closeModal();
		},
	});

	function closeModal() {
		navigate({ to: returnTo, replace: true, resetScroll: false });
	}

	const onSubmit = (data: EditionFormData) =>
		saveMutation.mutate({
			id: bookId,
			editionId,
			// a disabled field is left out of the data: an edition with readings keeps its model
			edition: toSaveEdition({ ...data, modelId: hasReadings ? (edition?.modelId ?? "") : data.modelId }),
		});

	const title = editionId ? "Modifier l'édition" : "Ajouter une édition";
	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Modal className={"modal form dialog-medium"} isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">{title}</h2>
				</div>
				<div className="dialog-body">
					<div className="panel">
						<h3>Édition</h3>
						<div className="form-grid">
							<label className="form-field full-width">
								<span>Titre de l'édition</span>
								<input {...register("title")} type="text" placeholder={book.book} autoComplete="off" />
							</label>
							<div className="form-field">
								<span>Éditeur</span>
								<Controller
									control={control}
									name="publisherId"
									render={({ field: { value, onChange } }) => (
										<EntitySearchSelect
											kind="organization"
											value={value}
											onChange={(entityId) => onChange(entityId ?? "")}
											aria-label="Éditeur"
										/>
									)}
								/>
							</div>
							<label className="form-field">
								<span>Collection</span>
								<input {...register("collection")} type="text" placeholder="Folio Classique" />
							</label>
							<label className="form-field">
								<span>Type</span>
								<select {...register("type")}>
									<option value="">—</option>
									{Object.entries(EDITION_TYPE_LABELS).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</select>
							</label>
							<label className="form-field">
								<span>Langue</span>
								<input {...register("language")} type="text" />
							</label>
							<label className="form-field">
								<span>Pages</span>
								<input {...register("pages")} type="number" min={1} />
							</label>
							<label className="form-field">
								<span>Modèle</span>
								{/* the entries of its readings point to the chapters of its model */}
								<select {...register("modelId")} disabled={hasReadings}>
									<option value="">—</option>
									{book.models.map((model) => (
										<option key={model.id} value={model.id}>
											{model.name}
										</option>
									))}
								</select>
								{hasReadings && (
									<span className="smalltext">
										Cette édition a des lectures : son modèle ne change plus.
									</span>
								)}
							</label>
							<label className="form-field">
								<span>ISBN</span>
								<input {...register("isbn")} type="text" autoComplete="off" />
							</label>
							<label className="form-field">
								<span>Année</span>
								<input {...register("year")} type="number" />
							</label>
							<div className="form-field full-width">
								<span>Traduction</span>
								{translators.fields.map((field, index) => (
									<div key={field.id} className="full-fields-row">
										<Controller
											control={control}
											name={`translators.${index}.entityId`}
											render={({ field: { value, onChange } }) => (
												<EntitySearchSelect
													kind="person"
													value={value}
													onChange={(entityId) => onChange(entityId ?? "")}
													aria-label={`Traducteur·ice ${index + 1}`}
												/>
											)}
										/>
										<input
											type="text"
											{...register(`translators.${index}.creditedAs` as const)}
											placeholder="Crédité·e comme"
											aria-label={`Traducteur·ice ${index + 1} crédité·e comme`}
										/>
										<button
											type="button"
											onClick={() => translators.remove(index)}
											title="Supprimer"
										>
											<i className="fa-regular fa-trash-can"></i>
										</button>
									</div>
								))}
								<div>
									<button
										type="button"
										onClick={() => translators.append({ entityId: "", creditedAs: "" })}
										title="Ajouter un·e traducteur·ice"
									>
										<i className="fa-regular fa-plus"></i>
									</button>
								</div>
							</div>
						</div>
					</div>
					<div className="panel">
						<h3>Couverture</h3>
						<div className="form-grid">
							<div className="form-field full-width">
								{/* the current cover, left of the zone that replaces it (dropped, picked or pasted) */}
								<div className="cover-input">
									{cover && <img src={coverSrc(cover)} alt="Couverture" className="cover-preview" />}
									<ImageDropZone
										onImage={async (file) =>
											setValue("cover", await readImageFile(file), { shouldDirty: true })
										}
									/>
								</div>
								<div className="full-fields-row">
									<input
										{...register("cover")}
										type="text"
										placeholder="ou https://…"
										aria-label="URL de la couverture"
										autoComplete="off"
										className="flex"
									/>
									{cover && (
										<button
											type="button"
											onClick={() => setValue("cover", "", { shouldDirty: true })}
											title="Retirer la couverture"
										>
											<i className="fa-regular fa-trash-can"></i>
										</button>
									)}
								</div>
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
						Enregistrer
					</button>
				</div>
			</Modal>
		</form>
	);
}
