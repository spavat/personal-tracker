import { useFieldArray, useFormContext } from "react-hook-form";

import { type GameInputs } from "./GameForm.utils";

export default function GameForm() {
	const {
		control,
		register,
		formState: { errors },
	} = useFormContext<GameInputs>();
	const {
		fields: fieldsLinks,
		append: appendLink,
		remove: removeLink,
	} = useFieldArray({
		control: control,
		name: "game.links",
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
