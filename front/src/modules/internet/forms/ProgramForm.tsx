import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import Badge from "../../../components/badge";
import BadgeEdit from "../../../components/badge-edit";
import { API_BASE_URL } from "../../../config";
import { type ProgramInputs } from "./ProgramForm.utils";

function readImageFile(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => resolve(e.target?.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

function resolveImagePreviewSrc(value?: string) {
	if (!value) return undefined;
	return value.startsWith("/") ? `${API_BASE_URL}${value}` : value;
}

export default function ProgramForm({ onLatestAsked }: { onLatestAsked?: (type: string, url: string) => void }) {
	const { control, register, getValues, setValue } = useFormContext<ProgramInputs>();
	const [country, profile, banner] = useWatch({
		control,
		name: ["program.country", "program.profile", "program.banner"],
	});

	async function onImageFileChange(field: "profile" | "banner", e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		const content = await readImageFile(file);
		setValue(`program.${field}`, content, { shouldDirty: true });
	}
	const {
		fields: fieldsTags,
		append: appendTag,
		remove: removeTag,
	} = useFieldArray({
		control: control,
		name: "program.tags",
	});
	const {
		fields: fieldsLink,
		append: appendLink,
		remove: removeLink,
	} = useFieldArray({
		control: control,
		name: "program.links",
	});
	const {
		fields: fieldsRefs,
		append: appendRef,
		remove: removeRef,
	} = useFieldArray({
		control: control,
		name: "program.refs",
	});

	return (
		<>
			<div className="panel">
				<h3>Général</h3>
				<div className="form-grid">
					<label className="form-field full-width">
						<span>
							Titre <span className="req">*</span>
						</span>
						<input {...register("program.name", { required: true })} type="text" autoComplete="off" />
					</label>
					<label className="form-field full-width">
						<span>Titre court</span>
						<input {...register("program.shortName")} type="text" autoComplete="off" />
					</label>

					<label className="form-field">
						<span>Auteur</span>
						<input {...register("program.author")} type="text" />
					</label>

					<label className="form-field">
						<span>Réseau</span>
						<input {...register("program.network")} type="text" />
					</label>

					<label className="form-field">
						<span>Pays</span>
						<div>
							<input {...register("program.country", { maxLength: 2 })} type="text" maxLength={2} />{" "}
							<span className={`fi fi-${country}`}></span>
						</div>
					</label>

					<label className="form-field">
						<span>Type</span>
						<select {...register("program.type", { required: true })}>
							<option value={""}></option>
							<option value={"podcast"}>Podcast</option>
							<option value={"youtube"}>Chaine Youtube</option>
							<option value={"media"}>Media</option>
							<option value={"tv"}>Télévision</option>
							<option value={"radio"}>Radio</option>
							<option value={"twitch"}>Twitch</option>
						</select>
					</label>

					<label className="form-field full-width">
						<span>Description</span>
						<textarea {...register("program.description")} />
					</label>
				</div>
			</div>

			<div className="panel">
				<h3>Images</h3>
				<div className="form-grid">
					<div className="form-field">
						<label htmlFor="program-profile">
							<span>Profil</span>
						</label>
						<input
							id="program-profile"
							{...register("program.profile")}
							type="text"
							placeholder="https://…"
							autoComplete="off"
						/>
						<input type="file" accept="image/*" onChange={(e) => onImageFileChange("profile", e)} />
						{profile && (
							<img
								src={resolveImagePreviewSrc(profile)}
								alt="Profil"
								className="image-preview profile-preview"
							/>
						)}
					</div>

					<div className="form-field">
						<label htmlFor="program-banner">
							<span>Bannière</span>
						</label>
						<input
							id="program-banner"
							{...register("program.banner")}
							type="text"
							placeholder="https://…"
							autoComplete="off"
						/>
						<input type="file" accept="image/*" onChange={(e) => onImageFileChange("banner", e)} />
						{banner && (
							<img
								src={resolveImagePreviewSrc(banner)}
								alt="Bannière"
								className="image-preview banner-preview"
							/>
						)}
					</div>
				</div>
			</div>

			<div className="panel">
				<h3>Liens</h3>
				<div>
					{fieldsLink.map((field, index) => (
						<div key={field.id} className="full-fields-row">
							<input
								type="text"
								{...register(`program.links.${index}.value` as const)}
								className="flex"
							/>
							<button type="button" onClick={() => removeLink(index)} title="Supprimer">
								<i className="fa-regular fa-trash-can"></i>
							</button>
							<br />
						</div>
					))}
					<button type="button" onClick={() => appendLink({ value: "" })}>
						<i className="fa-regular fa-plus"></i> Ajouter un lien
					</button>
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
							<input type="text" {...register(`program.tags.${index}.value` as const)} />
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
				</div>
			</div>

			<div className="panel">
				<h3>Références</h3>
				<div>
					{fieldsRefs.map((field, index) => (
						<div key={field.id} className="full-fields-row">
							<select {...register(`program.refs.${index}.key` as const)}>
								<option value="youtubeChannelId">Youtube Channel</option>
								<option value="youtubePlaylistId">Youtube Playlist</option>
								<option value="rss">RSS</option>
							</select>
							<input
								style={{ width: "60%" }}
								type="text"
								{...register(`program.refs.${index}.value` as const)}
								className="flex"
							/>
							<button type="button" onClick={() => removeRef(index)} title="Supprimer">
								<i className="fa-regular fa-trash-can"></i>
							</button>
							<button
								type="button"
								title="Fetch RSS"
								onClick={() => {
									const currentType = getValues(`program.refs.${index}.key`);
									const currentUrl = getValues(`program.refs.${index}.value`);
									if (currentType && currentUrl) {
										onLatestAsked?.(currentType, currentUrl);
									}
								}}
							>
								<i className="fa-solid fa-rss"></i>
							</button>
						</div>
					))}
					<button type="button" onClick={() => appendRef({ key: "", value: "" })}>
						<i className="fa-regular fa-plus"></i> Ajouter une référence
					</button>
				</div>
			</div>
		</>
	);
}
