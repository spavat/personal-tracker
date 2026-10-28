import { useFieldArray, useFormContext } from "react-hook-form";

import Badge from "../../../components/badge";
import BadgeEdit from "../../../components/badge-edit";
import { type MusicListeningForm } from "./ListeningsForm.utils";

export default function ListeningForm() {
	const {
		control,
		register,
		formState: { errors },
	} = useFormContext<MusicListeningForm>();

	const {
		fields: fieldsArtist,
		append: appendArtist,
		remove: removeArtist,
	} = useFieldArray({
		control: control,
		name: "artist",
	});
	const {
		fields: fieldsContextTags,
		append: appendContextTag,
		remove: removeContextTag,
	} = useFieldArray({
		control: control,
		name: "contextTags",
	});

	return (
		<>
			<div className="panel">
				<h3>Informations</h3>
				<div className="form-grid">
					<label className="form-field full-width">
						<span>Artistes</span>
						{fieldsArtist.map((field, index) => (
							<div key={field.id} className="full-fields-row">
								<input type="text" {...register(`artist.${index}.value` as const)} className="flex" />
								{(index !== 0 || fieldsArtist.length > 1) && (
									<button type="button" onClick={() => removeArtist(index)} title="Supprimer">
										<i className="fa-regular fa-trash-can"></i>
									</button>
								)}
								{index === fieldsArtist.length - 1 && (
									<button
										type="button"
										onClick={() => appendArtist({ value: "" })}
										title="Ajouter un artiste"
									>
										<i className="fa-regular fa-plus"></i>
									</button>
								)}
							</div>
						))}
						{errors.artist && <span className="error">L'artiste est obligatoire</span>}
					</label>
					<label className="form-field">
						<span>Album</span>
						<input {...register("album", { required: true })} type="text" autoComplete="off" />
						{errors.album && <span className="error">L'album est obligatoire</span>}
					</label>
					<label className="form-field">
						<span>Durée (min)</span>
						<input
							{...register("duration", { required: true, valueAsNumber: true })}
							type="number"
							autoComplete="off"
						/>
						{errors.duration && <span className="error">La durée est obligatoire</span>}
					</label>
					<label className="form-field">
						<span>Date d'écoute</span>
						<input {...register("listeningDate")} type="date" autoComplete="off" />
						{errors.listeningDate && <span className="error">La date est obligatoire</span>}
					</label>
					<label className="form-field">
						<span>Date (ou année) de release</span>
						<input {...register("releaseDate")} type="text" autoComplete="off" />
					</label>
					<label className="form-field">
						<span>Genre</span>
						<input {...register("genre")} type="text" />
					</label>
					<label className="form-field checkbox">
						<input {...register("compilation")} type="checkbox" />
						<span>Compilation</span>
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
							<input type="text" {...register(`contextTags.${index}.value` as const)} />
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
			</div>
		</>
	);
}
