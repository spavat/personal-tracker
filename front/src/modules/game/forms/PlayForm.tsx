import { useFormContext } from "react-hook-form";

import { type PlayInputs } from "./PlayForm.utils";

export default function PlayForm() {
	const {
		register,
		formState: { errors },
	} = useFormContext<PlayInputs>();
	return (
		<div className="panel">
			<h3>Infos de la partie</h3>
			<div className="form-grid">
				<label className="form-field">
					<span>
						Date <span className="req">*</span>
					</span>
					<input {...register("play.date", { required: true })} type="date" />
					{errors.play?.date && <span className="error">La date est obligatoire</span>}
				</label>
				<label className="form-field">
					<span>Durée (min)</span>
					<input
						{...register("play.duration", {
							// an empty field is no duration, not NaN
							setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
						})}
						type="number"
						min={0}
					/>
				</label>

				<label className="form-field full-width">
					<span>Commentaire</span>
					<textarea {...register("play.comment")}></textarea>
				</label>
			</div>
		</div>
	);
}
