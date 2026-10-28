import { MangaTypeEnumSchema, StatusEnumSchema } from "@personal-tracker/shared/reading-manga";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Fragment } from "react/jsx-runtime";

import Badge from "../../../components/badge";
import BadgeEdit from "../../../components/badge-edit";
import { type MangaForm } from "./MangaForm.utils";

export default function MangaFormComponent() {
	const {
		control,
		register,
		formState: { errors },
	} = useFormContext<MangaForm>();
	const {
		fields: fieldsAuthor,
		append: appendAuthor,
		remove: removeAuthor,
	} = useFieldArray({
		control: control,
		name: "manga.author",
	});
	const {
		fields: fieldsArt,
		append: appendArt,
		remove: removeArt,
	} = useFieldArray({
		control: control,
		name: "manga.art",
	});
	const {
		fields: fieldsScenario,
		append: appendScenario,
		remove: removeScenario,
	} = useFieldArray({
		control: control,
		name: "manga.scenario",
	});
	const {
		fields: fieldsLinks,
		append: appendLinks,
		remove: removeLinks,
	} = useFieldArray({
		control: control,
		name: "manga.links",
	});
	const {
		fields: fieldsGenres,
		append: appendGenres,
		remove: removeGenres,
	} = useFieldArray({
		control: control,
		name: "manga.genres",
	});
	return (
		<Fragment>
			<div className="panel">
				<h3>Général</h3>
				<div className="form-grid">
					<label className="form-field full-width">
						<span>
							Titre <span className="req">*</span>
						</span>
						<input {...register("manga.title", { required: true })} type="text" autoComplete="off" />
						{errors.manga?.title && <span className="error">Le titre est obligatoire</span>}
					</label>

					<label className="form-field full-width">
						<span>Titre anglais</span>
						<input {...register("manga.titleEnglish")} type="text" autoComplete="off" />
					</label>

					<label className="form-field">
						<span>Statut lecture</span>
						<select {...register("manga.status")}>
							{StatusEnumSchema.options.map((status) => (
								<option key={status} value={status}>
									{status}
								</option>
							))}
						</select>
					</label>

					<label className="form-field">
						<span>Type</span>
						<select {...register("manga.type")}>
							{MangaTypeEnumSchema.options.map((type) => (
								<option key={type} value={type}>
									{type}
								</option>
							))}
						</select>
					</label>
				</div>
			</div>

			<div className="panel">
				<h3>Artiste(s)</h3>
				<div className="form-grid">
					<label className="form-field full-width">
						<span>Mangaka</span>
						{fieldsAuthor.map((field, index) => (
							<div key={field.id} className="full-fields-row">
								<input
									type="text"
									{...register(`manga.author.${index}.value` as const)}
									className="flex"
								/>
								{(index !== 0 || fieldsAuthor.length > 1) && (
									<button type="button" onClick={() => removeAuthor(index)} title="Supprimer">
										<i className="fa-regular fa-trash-can"></i>
									</button>
								)}
								{index === fieldsAuthor.length - 1 && (
									<button type="button" onClick={() => appendAuthor({ value: "" })} title="Ajouter">
										<i className="fa-regular fa-plus"></i>
									</button>
								)}
							</div>
						))}
						{errors.manga?.author && <span className="error">Un nom ne peut pas être vide</span>}
						{fieldsAuthor.length === 0 && (
							<button type="button" onClick={() => appendAuthor({ value: "" })}>
								<i className="fa-regular fa-plus"></i>
							</button>
						)}
					</label>

					<label className="form-field full-width">
						<span>Dessin</span>
						{fieldsArt.map((field, index) => (
							<div key={field.id} className="full-fields-row">
								<input
									type="text"
									{...register(`manga.art.${index}.value` as const)}
									className="flex"
								/>
								{(index !== 0 || fieldsArt.length > 1) && (
									<button type="button" onClick={() => removeArt(index)} title="Supprimer">
										<i className="fa-regular fa-trash-can"></i>
									</button>
								)}
								{index === fieldsArt.length - 1 && (
									<button type="button" onClick={() => appendArt({ value: "" })} title="Ajouter">
										<i className="fa-regular fa-plus"></i>
									</button>
								)}
							</div>
						))}
						{errors.manga?.art && <span className="error">Un nom ne peut pas être vide</span>}
						{fieldsArt.length === 0 && (
							<button type="button" onClick={() => appendArt({ value: "" })} title="Ajouter">
								<i className="fa-regular fa-plus"></i>
							</button>
						)}
					</label>

					<label className="form-field full-width">
						<span>Scenario</span>
						{fieldsScenario.map((field, index) => (
							<div key={field.id} className="full-fields-row">
								<input
									type="text"
									{...register(`manga.scenario.${index}.value` as const)}
									className="flex"
								/>
								{(index !== 0 || fieldsScenario.length > 1) && (
									<button type="button" onClick={() => removeScenario(index)} title="Supprimer">
										<i className="fa-regular fa-trash-can"></i>
									</button>
								)}
								{index === fieldsScenario.length - 1 && (
									<button type="button" onClick={() => appendScenario({ value: "" })} title="Ajouter">
										<i className="fa-regular fa-plus"></i>
									</button>
								)}
							</div>
						))}
						{errors.manga?.scenario && <span className="error">Un nom ne peut pas être vide</span>}
						{fieldsScenario.length === 0 && (
							<button type="button" onClick={() => appendScenario({ value: "" })} title="Ajouter">
								<i className="fa-regular fa-plus"></i>
							</button>
						)}
					</label>
				</div>
			</div>

			<div className="panel">
				<h3>Genres</h3>
				<div>
					{fieldsGenres.map((field, index) => (
						<BadgeEdit
							key={field.id}
							icon="fa-solid fa-tag"
							color="white"
							backgroundColor="green"
							className="badge-edit"
							onClickRemove={() => removeGenres(index)}
						>
							<input type="text" {...register(`manga.genres.${index}.value` as const)} />
						</BadgeEdit>
					))}
					<Badge
						icon="fa-solid fa-plus"
						name="Ajouter un genre"
						color="white"
						backgroundColor="unset"
						onClick={() => appendGenres({ value: "" })}
						className="badge-add"
					></Badge>
				</div>
				{errors.manga?.genres && <span className="error">Un genre ne peut pas être vide</span>}
			</div>

			<div className="panel">
				<h3>Liens</h3>
				{(fieldsLinks ?? []).map((field, index) => (
					<div key={field.id} className="full-fields-row">
						<input type="text" {...register(`manga.links.${index}.name` as const)} />
						<input type="text" {...register(`manga.links.${index}.url` as const)} className="flex" />

						<button type="button" onClick={() => removeLinks(index)} title="Supprimer">
							<i className="fa-regular fa-trash-can"></i>
						</button>
						{errors.manga?.links?.[index]?.url && <span className="error">URL invalide</span>}
					</div>
				))}
				<button type="button" onClick={() => appendLinks({ name: "", url: "" })}>
					<i className="fa-regular fa-plus"></i> Ajouter un lien
				</button>
			</div>
		</Fragment>
	);
}
