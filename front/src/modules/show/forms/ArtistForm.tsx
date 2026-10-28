import { useFormContext } from "react-hook-form";

import { type ArtistForm } from "./ArtistForm.utils";

export default function ArtistFormComponent() {
	const {
		register,
		formState: { errors },
	} = useFormContext<ArtistForm>();

	return (
		<div className="panel">
			<h3>Général</h3>
			<div className="form-grid">
				<label className="form-field full-width">
					<span>
						Nom <span className="req">*</span>
					</span>
					<input {...register("artist.name", { required: true })} type="text" autoComplete="off" />
					{errors.artist?.name && <span className="error">Le nom est obligatoire</span>}
				</label>
			</div>
		</div>
	);
}
