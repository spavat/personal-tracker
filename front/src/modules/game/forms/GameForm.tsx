import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { API_BASE_URL } from "../../../config";
import { STORE_ID_LABELS, type GameInputs } from "./GameForm.utils";

// a URL (Steam, GOG…) is stored by the server, which hands back its own /images/game/… URL
const PICTURE_FIELDS = [
	{ field: "capsule", label: "Petite bannière" },
	{ field: "header", label: "Image titre" },
] as const;

export default function GameForm() {
	const {
		control,
		register,
		formState: { errors },
	} = useFormContext<GameInputs>();
	const [capsule, header] = useWatch({ control, name: ["game.capsule", "game.header"] });
	const {
		fields: fieldsLinks,
		append: appendLink,
		remove: removeLink,
	} = useFieldArray({
		control: control,
		name: "game.links",
	});
	const {
		fields: fieldsStoreIds,
		append: appendStoreId,
		remove: removeStoreId,
	} = useFieldArray({
		control: control,
		name: "game.storeIds",
	});

	return (
		<>
			<div className="panel">
				<h3>Général</h3>
				<div className="form-grid">
					<label className="form-field full-width">
						<span>Nom</span>
						<input {...register("game.name", { required: true })} type="text" autoComplete="off" />
						{errors.game?.name && <span className="error">Le nom est obligatoire</span>}
					</label>
					<label className="form-field">
						<span>Developpeur</span>
						<input {...register("game.developper", { required: true })} type="text" autoComplete="off" />
						{errors.game?.developper && <span className="error">Le développeur est obligatoire</span>}
					</label>
					<label className="form-field">
						<span>Editeur</span>
						<input {...register("game.editor", { required: true })} type="text" autoComplete="off" />
						{errors.game?.editor && <span className="error">L'éditeur est obligatoire</span>}
					</label>

					<label className="form-field checkbox">
						<input {...register("game.complete")} type="checkbox" />
						<span>Terminé</span>
					</label>

					<label className="form-field full-width">
						<span>Commentaire</span>
						<textarea {...register("game.comment")} />
					</label>
				</div>
			</div>

			<div className="panel">
				<h3>Images</h3>
				<div className="form-grid">
					{PICTURE_FIELDS.map(({ field, label }) => {
						const value = field === "capsule" ? capsule : header;
						return (
							<div key={field} className="form-field">
								<label htmlFor={`game-${field}`}>
									<span>{label}</span>
								</label>
								<input
									id={`game-${field}`}
									{...register(`game.${field}`)}
									type="text"
									placeholder="https://…"
									autoComplete="off"
								/>
								{value && (
									<img
										src={value.startsWith("/") ? `${API_BASE_URL}${value}` : value}
										alt={label}
										className={`image-preview game-${field}`}
									/>
								)}
							</div>
						);
					})}
				</div>
			</div>

			<div className="panel">
				<h3>Magasins</h3>
				<div>
					{fieldsStoreIds.map((field, index) => (
						<div key={field.id} className="full-fields-row">
							<select {...register(`game.storeIds.${index}.key` as const)}>
								{Object.entries(STORE_ID_LABELS).map(([key, label]) => (
									<option key={key} value={key}>
										{label}
									</option>
								))}
							</select>
							<input
								type="text"
								{...register(`game.storeIds.${index}.value` as const)}
								autoComplete="off"
								className="flex"
							/>
							<button type="button" onClick={() => removeStoreId(index)} title="Supprimer">
								<i className="fa-regular fa-trash-can"></i>
							</button>
						</div>
					))}
					<button type="button" onClick={() => appendStoreId({ key: "steam", value: "" })}>
						<i className="fa-regular fa-plus"></i> Ajouter un magasin
					</button>
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
								{...register(`game.links.${index}.name` as const)}
							/>
							<input
								type="text"
								{...register(`game.links.${index}.link` as const)}
								autoComplete="off"
								className="flex"
							/>
							<button type="button" onClick={() => removeLink(index)} title="Supprimer">
								<i className="fa-regular fa-trash-can"></i>
							</button>
						</div>
					))}
					<button type="button" onClick={() => appendLink({ name: "", link: "" })}>
						<i className="fa-regular fa-plus"></i> Ajouter un lien
					</button>
				</div>
			</div>
		</>
	);
}
