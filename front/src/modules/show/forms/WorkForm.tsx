import { useFormContext } from "react-hook-form";

import { type WorkForm } from "./WorkForm.utils";

export default function WorkFormComponent({ title }: { title?: string }) {
	const {
		register,
		formState: { errors },
	} = useFormContext<WorkForm>();
	const panelTitle = title ?? "Général";

	return (
		<div>
			<div className="panel">
				<h3>{panelTitle}</h3>
				<div className="from-grid">
					<label className="form-field full-width">
						<span>
							Nom <span className="req">*</span>
						</span>
						<input {...register("work.name", { required: true })} type="text" autoComplete="off" />
						{errors.work?.name && <span className="error">Le nom est obligatoire</span>}
					</label>
				</div>
			</div>
		</div>
	);
}
