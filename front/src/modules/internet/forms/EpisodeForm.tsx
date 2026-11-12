import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import Badge from "../../../components/Badge";
import BadgeEdit from "../../../components/BadgeEdit";
import { programsQuery } from "../api";
import { type EpisodeInputs } from "./EpisodeForm.utils";

export default function EpisodeForm() {
	const { control, register } = useFormContext<EpisodeInputs & { programId?: string }>();
	const [showParentTags, setShowParentTags] = useState(false);

	const {
		fields: fieldsTags,
		append: appendTag,
		remove: removeTag,
	} = useFieldArray({
		control: control,
		name: "episode.tags",
	});
	const {
		fields: fieldsContextTags,
		append: appendContextTag,
		remove: removeContextTag,
	} = useFieldArray({
		control: control,
		name: "episode.contextTags",
	});
	const {
		fields: fieldsIgnoredTags,
		append: appendIgnoredTag,
		remove: removeIgnoredTag,
		replace: replaceIgnoredTags,
	} = useFieldArray({
		control: control,
		name: "episode.ignoredTags",
	});

	// Tags of the selected program: the episode inherits them, unless ignored
	const programId = useWatch({ control, name: "programId" });
	const { data: programs } = useQuery(programsQuery());
	const parentTags = programs?.find((p) => p.id === programId)?.tags ?? [];
	const ignorableTags = parentTags.filter((tag) => !fieldsIgnoredTags.some((field) => field.value === tag));

	// Ignored tags of another program mean nothing for the new one
	const previousProgramId = useRef(programId);
	useEffect(() => {
		if (previousProgramId.current !== programId) {
			previousProgramId.current = programId;
			replaceIgnoredTags([]);
			setShowParentTags(false);
		}
	}, [programId, replaceIgnoredTags]);

	return (
		<>
			<div className="panel">
				<h3> Infos de l'épisode</h3>
				<div className="form-grid">
					<label className="form-field full-width">
						<span>
							Titre <span className="req">*</span>
						</span>
						<input {...register("episode.name", { required: true })} type="text" autoComplete="off" />
					</label>

					<label className="form-field">
						<span>
							Durée <span className="req">*</span>
						</span>
						<input
							{...register("episode.duration", { required: true, valueAsNumber: true })}
							type="number"
							autoComplete="off"
						/>
					</label>
					<label className="form-field">
						<span>Durée réelle</span>
						<input
							{...register("episode.durationReal", { valueAsNumber: true })}
							type="number"
							autoComplete="off"
						/>
					</label>

					<label className="form-field">
						<span>
							Date <span className="req">*</span>
						</span>
						<input {...register("episode.date", { required: true })} type="date" />
					</label>
					<label className="form-field">
						<span>
							Type <span className="req">*</span>
						</span>
						<select {...register("episode.type", { required: true })}>
							<option value={"video"}>video</option>
							<option value={"podcast"}>podcast</option>
							<option value={"live"}>live</option>
							<option value={"radio"}>radio</option>
						</select>
					</label>

					<label className="form-field">
						<span>Lien</span>
						<input {...register("episode.link")} type="text" />
					</label>
					<label className="form-field">
						<span>Id externe</span>
						<input
							{...register("episode.externalId", {
								setValueAs: (value) => (value == null ? value : String(value)), // coerce in string number value
							})}
							type="text"
							readOnly
						/>
					</label>
					<label className="form-field full-width">
						<span>Commentaire</span>
						<textarea className="comment" {...register("episode.comment")}></textarea>
					</label>
					<label className="form-field" style={{ display: "none" }}>
						<span>
							Date de creation <span className="req">*</span>
						</span>
						<input {...register("episode.created")} type="datetime-local" step="1" />
					</label>
				</div>
			</div>

			<div className="panel">
				<h3>Tags</h3>
				<div>
					{fieldsTags.map((field, index) => (
						<BadgeEdit
							key={field.id}
							icon="fa-solid fa-tag"
							color="white"
							backgroundColor="green"
							className="badge-edit"
							onClickRemove={() => removeTag(index)}
						>
							<input type="text" {...register(`episode.tags.${index}.value` as const)} />
						</BadgeEdit>
					))}
					{fieldsIgnoredTags.map((field, index) => (
						<BadgeEdit
							key={field.id}
							icon="fa-solid fa-ban"
							color="white"
							backgroundColor="red"
							className="badge-edit"
							title="Tag du programme ignoré"
							onClickRemove={() => removeIgnoredTag(index)}
						>
							{field.value}
						</BadgeEdit>
					))}
					<Badge
						icon="fa-solid fa-plus"
						name="Ajouter un tag"
						color="white"
						backgroundColor="unset"
						onClick={() => appendTag({ value: "" })}
						className="badge-add"
					></Badge>
					{ignorableTags.length > 0 && (
						<Badge
							icon="fa-solid fa-ban"
							name="Ignorer un tag parent"
							color="white"
							backgroundColor="unset"
							onClick={() => setShowParentTags((b) => !b)}
							className="badge-add"
						></Badge>
					)}
				</div>
				{showParentTags && ignorableTags.length > 0 && (
					<div>
						{ignorableTags.map((tag) => (
							<Badge
								key={tag}
								icon="fa-solid fa-tag"
								name={tag}
								color="white"
								backgroundColor="green"
								className="badge-add"
								onClick={() => {
									appendIgnoredTag({ value: tag });
									setShowParentTags(false);
								}}
							></Badge>
						))}
					</div>
				)}
			</div>
			<div className="panel">
				<h3>Contexte Tags</h3>
				<div>
					{fieldsContextTags.map((field, index) => (
						<BadgeEdit
							key={field.id}
							icon="fa-solid fa-tag"
							color="white"
							backgroundColor="darkgrey"
							className="badge-edit"
							onClickRemove={() => removeContextTag(index)}
						>
							<input type="text" {...register(`episode.contextTags.${index}.value` as const)} />
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
