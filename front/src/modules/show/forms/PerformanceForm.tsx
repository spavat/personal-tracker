import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { placesQuery, spectaclesQuery } from "../api";
import { type PerformanceForm } from "./PerformanceForm.utils";

export default function PerformanceFormComponent({
	showFormPart,
}: {
	showFormPart: (type: "work" | "spectacle" | "place", value?: boolean) => void;
}) {
	const {
		register,
		control,
		setValue,
		formState: { errors },
	} = useFormContext<PerformanceForm>();
	const [spectacleId, placeId] = useWatch({ control, name: ["performance.spectacleId", "performance.placeId"] });

	const { data: spectacleList = [], isFetching: spectacleListIsFetching } = useQuery(spectaclesQuery());
	const { data: placeList = [], isFetching: placeListIsFetching } = useQuery(placesQuery());

	useEffect(() => {
		if (spectacleId) {
			showFormPart("spectacle", false);
		}
	}, [spectacleId, showFormPart]);

	useEffect(() => {
		if (placeId) {
			showFormPart("place", false);
		}
	}, [placeId, showFormPart]);

	const clickNewSpectacle = () => {
		setValue("performance.spectacleId", 0);
		showFormPart("spectacle");
	};

	const clickNewPlace = () => {
		setValue("performance.placeId", 0);
		showFormPart("place");
	};

	return (
		<>
			<div className="panel">
				<div className="title">
					<h3>Spectacle & Oeuvre</h3>
					<button type="button" onClick={clickNewSpectacle}>
						Ajouter
					</button>
				</div>

				<div className="form-grid">
					<label className="form-field full-width">
						<span>Spectacle</span>
						{spectacleListIsFetching ? (
							<>...</>
						) : (
							<select {...register("performance.spectacleId", { valueAsNumber: true })}>
								<option key={"empty"} value="0"></option>
								{spectacleList?.map((spectacle) => (
									<option key={spectacle.id} value={spectacle.id}>
										{spectacle.name}
									</option>
								))}
							</select>
						)}
						{errors.performance?.spectacleId && <span className="error">Le spectacle est obligatoire</span>}
					</label>
				</div>
			</div>
			<div className="panel">
				<div className="title">
					<h3>Lieu</h3>
					<button type="button" onClick={clickNewPlace}>
						Ajouter
					</button>
				</div>
				<div className="form-grid">
					<label className="form-field full-width">
						{placeListIsFetching ? (
							<>...</>
						) : (
							<select {...register("performance.placeId", { valueAsNumber: true })}>
								<option key={"empty"} value="0"></option>
								{placeList.map((place) => (
									<option key={place.id} value={place.id}>
										{place.name}
									</option>
								))}
							</select>
						)}
						{errors.performance?.placeId && <span className="error">Le lieu est obligatoire</span>}
					</label>
				</div>
			</div>
			<div className="panel">
				<h3>Détails Représentation</h3>
				<div className="form-grid">
					<label className="form-field">
						<span>Date</span>
						<input {...register("performance.date", { required: true })} type="datetime-local" />
						{errors.performance?.date && <span className="error">La date est obligatoire</span>}
					</label>
					<label className="form-field">
						<span>Place</span>
						<input {...register("performance.seat", { required: true })} type="text" autoComplete="off" />
					</label>

					<label className="form-field checkbox">
						<input {...register("performance.canceled")} type="checkbox" /> <span>Annulé</span>
					</label>
				</div>
			</div>
			<div className="panel">
				<h3>Distribution</h3>
				<div className="form-grid">
					<label className="form-field">
						<span>Statut</span>
						<select {...register("performance.casting_status")}>
							<option value="tbd">À définir</option>
							<option value="unknown">Inconnu</option>
							<option value="partial">Partiel</option>
							<option value="complete">Complet</option>
						</select>
					</label>
					<label className="form-field">
						<span>Origine</span>
						<select {...register("performance.casting_origin")}>
							<option value="na">Non applicable</option>
							<option value="program">Programme</option>
							<option value="performance">Représentation</option>
						</select>
					</label>
				</div>
			</div>
		</>
	);
}
