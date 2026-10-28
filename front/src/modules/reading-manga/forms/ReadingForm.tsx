import { OriginEnumSchema } from "@personal-tracker/shared/reading-manga";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Fragment } from "react/jsx-runtime";

import Badge from "../../../components/badge";
import BadgeEdit from "../../../components/badge-edit";
import { type ReadingForm } from "./ReadingForm.utils";

export default function ReadingFormComponent() {
	const {
		control,
		register,
		formState: { errors },
	} = useFormContext<ReadingForm>();

	const {
		fields: fieldsContextTags,
		append: appendContextTag,
		remove: removeContextTag,
	} = useFieldArray({
		control: control,
		name: "reading.contextTags",
	});
	return (
		<Fragment>
			<div className="panel">
				<h3>Infos de la lecture</h3>
				<div className="form-grid">
					<label className="form-field">
						<span>
							Nom <span className="req">*</span>
						</span>
						<input
							{...register("reading.name", { required: true })}
							type="text"
							autoComplete="off"
							placeholder="1180 ou 01"
						/>
						{errors.reading?.name && <span className="error">Le nom est obligatoire</span>}
					</label>
					<label className="form-field">
						<span>Type</span>
						<select {...register("reading.type", { required: true })}>
							<option value={"chapter"}>chapter</option>
							<option value={"volume"}>volume</option>
						</select>
					</label>

					<label className="form-field">
						<span>Titre</span>
						<input {...register("reading.title")} type="text" autoComplete="off" />
					</label>
					<label className="form-field">
						<span>Edition</span>
						<input {...register("reading.edition")} type="text" autoComplete="off" />
					</label>
					<label className="form-field">
						<span>Date</span>
						<input {...register("reading.date", { required: true })} type="date" />
					</label>

					<label className="form-field">
						<span>
							Langue <span className="req">*</span>
						</span>
						<input {...register("reading.language", { required: true })} type="text" />
						{errors.reading?.language && <span className="error">La langue est obligatoire</span>}
					</label>
					<label className="form-field">
						<span>Origine</span>
						<select {...register("reading.origin")}>
							{OriginEnumSchema.options.map((type) => (
								<option key={type} value={type}>
									{type}
								</option>
							))}
						</select>
					</label>
				</div>
			</div>

			<div className="panel">
				<h3>Contexte Tags</h3>
				<div>
					{fieldsContextTags.map((field, index) => (
						<BadgeEdit
							key={field.id}
							icon="fa-solid fa-tag"
							color="white"
							backgroundColor="green"
							className="badge-edit"
							onClickRemove={() => removeContextTag(index)}
						>
							<input type="text" {...register(`reading.contextTags.${index}.value` as const)} />
						</BadgeEdit>
					))}
					<Badge
						icon="fa-solid fa-plus"
						name="Ajouter un tag"
						color="white"
						backgroundColor="unset"
						onClick={() => appendContextTag({ value: "" })}
						className="badge-add"
					></Badge>
				</div>
				{errors.reading?.contextTags && <span className="error">Un tag ne peut pas être vide</span>}
			</div>
		</Fragment>
	);
}
