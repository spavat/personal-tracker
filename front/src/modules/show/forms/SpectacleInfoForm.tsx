import { useFieldArray, useFormContext } from "react-hook-form";

import { type SpectacleInfoForm } from "./SpectacleInfoForm.utils";

export default function SpectacleInfoFormComponent() {
	const {
		register,
		control,
		formState: { errors },
	} = useFormContext<SpectacleInfoForm>();
	const {
		fields: fieldsLinks,
		append: appendLink,
		remove: removeLink,
	} = useFieldArray({
		control: control,
		name: "spectacle.links",
	});

	return (
		<>
			<div className="panel">
				<h3>Général</h3>
				<div className="form-grid">
					<label className="form-field full-width">
						<span>
							Nom <span className="req">*</span>
						</span>
						<input {...register("spectacle.name", { required: true })} type="text" autoComplete="off" />
						{errors.spectacle?.name && <span className="error">Le nom est obligatoire</span>}
					</label>
					<label className="form-field full-width">
						<span>Description</span>
						<textarea {...register("spectacle.description")} rows={5} />
					</label>
					<label className="form-field full-width">
						<span>Source de la description</span>
						<input {...register("spectacle.descriptionSource")} type="url" autoComplete="off" />
						{errors.spectacle?.descriptionSource && <span className="error">URL invalide</span>}
					</label>
				</div>
			</div>

			<div className="panel">
				<h3>Liens</h3>
				<div>
					{fieldsLinks.map((field, index) => (
						<div key={field.id} className="full-fields-row">
							<input
								style={{ width: "40%" }}
								type="text"
								placeholder="Libellé"
								{...register(`spectacle.links.${index}.label` as const)}
							/>
							<input
								type="url"
								placeholder="https://"
								{...register(`spectacle.links.${index}.url` as const)}
								autoComplete="off"
								className="flex"
							/>
							<button type="button" onClick={() => removeLink(index)} title="Supprimer">
								<i className="fa-regular fa-trash-can"></i>
							</button>
						</div>
					))}
					{errors.spectacle?.links && <span className="error">Libellé et URL valide obligatoires</span>}
					<button type="button" onClick={() => appendLink({ label: "", url: "" })}>
						<i className="fa-regular fa-plus"></i> Ajouter un lien
					</button>
				</div>
			</div>

			<div className="panel">
				<h3>Programme</h3>
				<label className="form-field full-width">
					<span className="smalltext">
						Markdown : <code># Acte 1</code>, <code>- Titre</code>, <code>*(chanson)*</code>
					</span>
					<textarea {...register("spectacle.tracklist")} rows={12} className="tracklist-input" />
				</label>
			</div>
		</>
	);
}
