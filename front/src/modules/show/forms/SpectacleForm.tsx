import { useQuery } from "@tanstack/react-query";
import { useFormContext } from "react-hook-form";

import { worksQuery } from "../api";
import { type SpectacleForm } from "./SpectacleForm.utils";

export default function SpectacleFormComponent({ title, onNewWork }: { title?: string; onNewWork: () => void }) {
	const {
		register,
		formState: { errors },
	} = useFormContext<SpectacleForm>();
	const panelTitle = title ?? "Général";

	const { data, isFetching } = useQuery(worksQuery());

	return (
		<div>
			<div className="panel">
				<h3>
					{panelTitle}
					<button type="button" onClick={onNewWork}>
						Ajouter Oeuvre
					</button>
				</h3>
				<div className="form-grid">
					<label className="form-field full-width">
						<span>
							Nom <span className="req">*</span>
						</span>
						<input {...register("spectacle.name", { required: true })} type="text" autoComplete="off" />
						{errors.spectacle?.name && <span className="error">Le nom est obligatoire</span>}
					</label>

					<label className="form-field full-width">
						<span>Oeuvre</span>
						{isFetching ? (
							<>...</>
						) : (
							<select {...register("spectacle.workId", { valueAsNumber: true })}>
								<option key={"empty"} value="0"></option>
								{data?.map((work) => (
									<option key={work.id} value={work.id}>
										{work.name}
									</option>
								))}
							</select>
						)}
						{errors.spectacle?.workId && (
							<span className="error">Choisir une oeuvre ou en ajouter une nouvelle</span>
						)}
					</label>
				</div>
			</div>
		</div>
	);
}
