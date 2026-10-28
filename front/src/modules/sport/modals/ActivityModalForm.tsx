import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";

import Modal from "../../../components/modal";
import MutationError from "../../../components/mutation-error";
import { useOptionalSuspenseQuery } from "../../../hooks/use-optional-suspense-query";
import { activityDetailsQuery, save } from "../api";
import { ACTIVITY_TYPES } from "../constants";

type ActivityFormInputs = {
	name: string;
	type: string;
	date?: string;
	movingDuration: number;
	totalDuration: number;
	distance: number;
	pace: number;
	comment: string;
};

const defaultValues: ActivityFormInputs = {
	name: "Course à pied",
	type: "running",
	movingDuration: 0,
	totalDuration: 0,
	distance: 0,
	pace: 0,
	comment: "",
};

export default function ActivityModalForm({ activityId, returnTo }: { activityId?: string; returnTo: string }) {
	const isEdit = Boolean(activityId);
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [gpxFile, setGpxFile] = useState<{ name: string; content: string } | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);

	const activity = useOptionalSuspenseQuery(activityId ? activityDetailsQuery(activityId) : undefined);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<ActivityFormInputs>({
		// data is loaded before the modal opens: applied once, never overwritten by a background refetch
		defaultValues: activity
			? {
					name: activity.name,
					type: activity.type,
					date: activity.date,
					movingDuration: activity.details.movingDuration,
					totalDuration: activity.details.totalDuration,
					distance: activity.details.distance,
					pace: activity.details.pace,
					comment: activity.comment ?? "",
				}
			: defaultValues,
	});

	const saveMutation = useMutation({
		mutationFn: save,
		onSuccess: () => {
			reset(defaultValues);
			setGpxFile(null);
			queryClient.invalidateQueries({ queryKey: ["sport", "activities"] });
			if (activityId) queryClient.invalidateQueries({ queryKey: ["sport", "activity", activityId] });
			closeModal();
		},
	});

	function closeModal() {
		reset(defaultValues);
		setGpxFile(null);
		navigate({
			to: returnTo,
			replace: true,
			resetScroll: false,
		});
	}

	const onSubmit: SubmitHandler<ActivityFormInputs> = (data) => {
		saveMutation.mutate({
			...(activityId ? { id: activityId } : {}),
			name: data.name,
			type: data.type,
			...(data.date ? { date: data.date } : {}),
			details: {
				// elevation isn't in the form
				...activity?.details,
				movingDuration: Number(data.movingDuration),
				totalDuration: Number(data.totalDuration),
				distance: Number(data.distance),
				pace: Number(data.pace),
			},
			comment: data.comment || undefined,
			...(gpxFile ? { rawData: gpxFile.content } : {}),
		});
	};

	function readGPXFile(file: File) {
		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			setGpxFile({ name: file.name, content });
		};
		reader.readAsText(file);
	}

	function onDrop(e: React.DragEvent) {
		e.preventDefault();
		setIsDragOver(false);
		const file = e.dataTransfer.files[0];
		if (file) readGPXFile(file);
	}

	function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (file) readGPXFile(file);
	}

	const dropZoneClass = ["gpx-drop-zone", isDragOver ? "drag-over" : "", gpxFile ? "has-file" : ""]
		.filter(Boolean)
		.join(" ");

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Modal className="modal form dialog-medium" isOpen={true} onClose={closeModal} hasCloseBtn={true}>
				<div className="dialog-header">
					<h2 id="dialog-title">{isEdit ? "Modifier activité" : "Ajouter activité"}</h2>
				</div>

				<div className="dialog-body single-panel">
					<div className="panel">
						<h3>Informations</h3>
						<div className="form-grid">
							<label className="form-field">
								<span>Nom</span>
								<input type="text" autoComplete="off" {...register("name", { required: true })} />
								{errors.name && <span className="error">Le nom est obligatoire</span>}
							</label>

							<label className="form-field">
								<span>Type</span>
								<select {...register("type", { required: true })}>
									<option value="">Sélectionner un type</option>
									{Object.entries(ACTIVITY_TYPES).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
									{activity && !(activity.type in ACTIVITY_TYPES) && (
										<option value={activity.type}>{activity.type}</option>
									)}
								</select>
								{errors.type && <span className="error">Le type est obligatoire</span>}
							</label>

							<label className="form-field">
								<span>Date</span>
								<input
									type="datetime-local"
									{...register("date", { validate: (value) => Boolean(value || gpxFile) })}
									step="1"
								/>
								{errors.date && <span className="error">La date est obligatoire sans fichier GPX</span>}
							</label>

							<label className="form-field full-width">
								<span>Commentaire</span>
								<textarea {...register("comment")} />
							</label>
						</div>
					</div>

					<div className="panel">
						<h3>Détails</h3>
						<div className="form-grid">
							<label>
								Distance (km)
								<input
									type="number"
									step="0.01"
									min="0"
									{...register("distance", { required: true, valueAsNumber: true })}
								/>
								{errors.distance && <span className="error">La distance est obligatoire</span>}
							</label>

							<label>
								Temps total (min)
								<input
									type="number"
									step="1"
									min="0"
									{...register("totalDuration", { required: true, valueAsNumber: true })}
								/>
								{errors.totalDuration && <span className="error">Le temps total est obligatoire</span>}
							</label>

							<label>
								Temps en mouvement (min)
								<input
									type="number"
									step="1"
									min="0"
									{...register("movingDuration", { required: true, valueAsNumber: true })}
								/>
								{errors.movingDuration && (
									<span className="error">Le temps en mouvement est obligatoire</span>
								)}
							</label>

							<label>
								Allure (min/km)
								<input
									type="number"
									step="0.01"
									min="0"
									{...register("pace", { required: true, valueAsNumber: true })}
								/>
								{errors.pace && <span className="error">L'allure est obligatoire</span>}
							</label>
						</div>
					</div>

					<div
						className={dropZoneClass}
						onDragOver={(e) => {
							e.preventDefault();
							setIsDragOver(true);
						}}
						onDragLeave={() => setIsDragOver(false)}
						onDrop={onDrop}
					>
						{gpxFile ? (
							<>
								<i className="fa-solid fa-check"></i> {gpxFile.name}
								&nbsp;
								<button type="button" onClick={() => setGpxFile(null)} title="Supprimer">
									✕
								</button>
							</>
						) : (
							<>
								<i className="fa-solid fa-file-import"></i>
								&nbsp;Glisser-déposer un fichier GPX
								<br />
								<label style={{ cursor: "pointer", textDecoration: "underline" }}>
									ou parcourir
									<input
										type="file"
										accept=".gpx"
										style={{ display: "none" }}
										onChange={onFileChange}
									/>
								</label>
							</>
						)}
					</div>

					{gpxFile && (
						<p style={{ fontSize: "0.85em", color: "#888" }}>
							Distance, temps et allure seront extraits du fichier GPX.
						</p>
					)}
				</div>

				<div className="dialog-footer">
					<MutationError error={saveMutation.error} />
					<button type="button" onClick={closeModal}>
						Annuler
					</button>
					<button type="submit" className="main" disabled={saveMutation.isPending}>
						{saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
					</button>
				</div>
			</Modal>
		</form>
	);
}
