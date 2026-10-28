import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { type PlaceForm } from "./PlaceForm.utils";

export default function PlaceFormComponent({ title }: { title?: string }) {
	const {
		register,
		control,
		formState: { errors },
	} = useFormContext<PlaceForm>();
	const country = useWatch({ control, name: "place.country" });
	const panelTitle = title ?? "Général";
	return (
		<div className="panel">
			<h3>{panelTitle}</h3>
			<div className="form-grid">
				<label className="form-field full-width">
					<span>
						Nom <span className="req">*</span>
					</span>
					<input {...register("place.name", { required: true })} type="text" autoComplete="off" />
					{errors.place?.name && <span className="error">Le nom est obligatoire</span>}
				</label>
				<label className="form-field full-width">
					<span>Adresse</span>
					<textarea className="address" {...register("place.address")}></textarea>
				</label>
				<label className="form-field">
					<span>Pays</span>
					<div>
						<input {...register("place.country", { maxLength: 2 })} type="text" maxLength={2} />{" "}
						<span className={`fi fi-${country}`}></span>
					</div>
				</label>
				<br />
				<label className="form-field full-width">
					<span>Site</span>
					<input {...register("place.link", { maxLength: 100 })} type="text" maxLength={100} />{" "}
					{errors.place?.link && <span className="error">URL invalide</span>}
				</label>
			</div>
		</div>
	);
}

export function PlaceFormerNamesFormComponent() {
	const {
		register,
		control,
		formState: { errors },
	} = useFormContext<PlaceForm>();
	const {
		fields: fieldsFormerNames,
		append: appendFormerName,
		remove: removeFormerName,
	} = useFieldArray({
		control: control,
		name: "place.formerNames",
	});
	return (
		<div className="panel">
			<h3>Anciens noms</h3>
			<div>
				{fieldsFormerNames.map((field, index) => (
					<div key={field.id} className="full-fields-row">
						<input
							type="text"
							{...register(`place.formerNames.${index}.name` as const, {
								required: true,
								maxLength: 100,
							})}
							maxLength={100}
							placeholder="Nom"
							className="flex"
						/>
						<label>
							<span>jusqu'au (exclu)</span>{" "}
							<input
								type="date"
								{...register(`place.formerNames.${index}.untilDate` as const, {
									required: true,
								})}
							/>
						</label>
						<button type="button" onClick={() => removeFormerName(index)} title="Supprimer">
							<i className="fa-regular fa-trash-can"></i>
						</button>
						{errors.place?.formerNames?.[index] && (
							<span className="error">Le nom et la date sont obligatoires</span>
						)}
					</div>
				))}
				{errors.place?.formerNames?.root && (
					<span className="error">Deux anciens noms ne peuvent pas finir le même jour</span>
				)}
				<button type="button" onClick={() => appendFormerName({ name: "", untilDate: "" })}>
					<i className="fa-regular fa-plus"></i> Ajouter un ancien nom
				</button>
			</div>
		</div>
	);
}
